/**
 * Seeding-policy selection for a tournament.
 *
 * A governing body's seeding rules are expressed as `seedsCountThresholds` — the factory's
 * extension point for exactly this. The catalog can already hold such a policy: courthive-components
 * ships a seeding editor that edits threshold rows, positioning profile, flags and per-drawType
 * overrides, and the `/policies` page persists the result through `policyBridge`. What was missing
 * was any way for one of those policies to reach a draw.
 *
 * It reaches one by being ATTACHED TO THE TOURNAMENT, not by being picked per draw. Compliance is a
 * property of the sanctioned competition: every draw in it seeds by the same rule, a draw
 * regenerated next week still does, and the add-draw form's existing "Inherited" option is already
 * the path that reads it (`getDrawFormItems` looks for a seeding policy on the event and then on
 * the tournamentRecord). A per-draw pick would let two draws in one event comply differently, which
 * is not a thing compliance permits.
 *
 * Mirrors `schedulingPolicyChoices` deliberately, including identity stamping — a `policyName`
 * carried in the policy body so a later re-open can recognize what is attached without depending on
 * structural equality.
 *
 * Authoring and editing policies is out of scope here; that lives on `/policies`.
 */
import { getBuiltinPolicies, loadUserPolicies } from 'pages/policies/policyBridge';
import type { PolicyCatalogItem } from 'courthive-components';
import { providerConfig } from 'config/providerConfig';
import { policyConstants } from 'tods-competition-factory';
import { t } from 'i18n';

const { POLICY_TYPE_SEEDING } = policyConstants;

/** Sentinel id for the synthetic entry representing the policy already on the tournamentRecord. */
export const ATTACHED_POLICY_ID = '__attached__';
/** Sentinel id for the provider's declared policy. */
export const PROVIDER_POLICY_ID = '__provider__';
/** Sentinel id for "no seeding policy attached" — draws fall back to the factory default. */
export const NO_POLICY_ID = '__none__';

export type SeedingPolicySource = 'provider' | 'builtin' | 'user' | 'attached' | 'none';

export interface SeedingPolicyChoice {
  id: string;
  label: string;
  /** `attachPolicies({ policyDefinitions })` input shape: `{ seeding: {...} }`. */
  definition: Record<string, any> | null;
  source: SeedingPolicySource;
}

/** Identity and volatile keys ignored when comparing two policies structurally. */
const IGNORED_KEYS = new Set(['policyName']);

function normalizedFingerprint(policy: Record<string, any> | null | undefined): string {
  if (!policy || typeof policy !== 'object') return '';
  const stable = (value: any): any => {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') {
      return Object.keys(value)
        .filter((key) => !IGNORED_KEYS.has(key))
        .sort((a, b) => a.localeCompare(b))
        .reduce((acc: Record<string, any>, key) => {
          acc[key] = stable(value[key]);
          return acc;
        }, {});
    }
    return value;
  };
  return JSON.stringify(stable(policy));
}

/** Stamp the choice's label as `policyName` so the identity travels with the tournamentRecord. */
function stamped(policy: Record<string, any>, name: string): Record<string, any> {
  return { [POLICY_TYPE_SEEDING]: { ...policy, policyName: policy.policyName || name } };
}

function toChoice(item: PolicyCatalogItem): SeedingPolicyChoice {
  return {
    id: item.id,
    label: item.name,
    definition: stamped(item.policyData, item.name),
    source: item.source === 'builtin' ? 'builtin' : 'user',
  };
}

/**
 * Every seeding policy a tournament could be given, most authoritative first.
 *
 * When the provider declares one it leads the list, and when
 * `providerConfig.isSeedingPolicyLocked()` it is the ONLY entry — a provider that both declares a
 * seeding policy and withholds `canModifyPolicies` is stating a rule, not a default.
 */
export async function loadSeedingChoices(): Promise<SeedingPolicyChoice[]> {
  const providerPolicy = providerConfig.getSeedingPolicy();
  const providerChoice: SeedingPolicyChoice[] = providerPolicy
    ? [
        {
          id: PROVIDER_POLICY_ID,
          label: policyLabel(providerPolicy, t('settings.seedingPolicy.providerPolicy')),
          definition: stamped(providerPolicy, policyLabel(providerPolicy, t('settings.seedingPolicy.providerPolicy'))),
          source: 'provider',
        },
      ]
    : [];

  if (providerPolicy && providerConfig.isSeedingPolicyLocked()) return providerChoice;

  const builtins = getBuiltinPolicies().filter((policy) => policy.policyType === POLICY_TYPE_SEEDING);

  let userPolicies: PolicyCatalogItem[] = [];
  try {
    const all = await loadUserPolicies();
    userPolicies = all.filter((policy) => policy.policyType === POLICY_TYPE_SEEDING);
  } catch (err) {
    // IndexedDB unavailable (private browsing, quota) must not empty the list — the builtins and
    // the provider policy are still perfectly usable without it.
    console.error('loadUserPolicies failed', err);
  }

  return [
    ...providerChoice,
    ...builtins.map(toChoice),
    ...userPolicies.map(toChoice),
    { id: NO_POLICY_ID, label: t('settings.seedingPolicy.none'), definition: null, source: 'none' },
  ];
}

function policyLabel(policy: Record<string, any>, fallback: string): string {
  return typeof policy?.policyName === 'string' && policy.policyName ? policy.policyName : fallback;
}

/**
 * Which choice, if any, equals the policy already attached to the tournament.
 * Identity (`policyName`) first, normalized structural compare as the fallback for policies
 * attached before identity stamping existed.
 */
export function resolveAttachedChoiceId(
  attached: Record<string, any> | null | undefined,
  choices: SeedingPolicyChoice[],
): string | null {
  if (!attached) return null;

  const attachedName = typeof attached.policyName === 'string' ? attached.policyName : '';
  if (attachedName) {
    const byName = choices.find((choice) => choice.definition?.[POLICY_TYPE_SEEDING]?.policyName === attachedName);
    if (byName) return byName.id;
  }

  const attachedFingerprint = normalizedFingerprint(attached);
  if (!attachedFingerprint) return null;
  const byShape = choices.find(
    (choice) => normalizedFingerprint(choice.definition?.[POLICY_TYPE_SEEDING]) === attachedFingerprint,
  );
  return byShape?.id ?? null;
}

/** A first-class entry for the attached policy, so re-selecting it is a no-op rather than a re-attach. */
export function buildAttachedChoice(attached: Record<string, any>, matchedLabel: string | null): SeedingPolicyChoice {
  return {
    id: ATTACHED_POLICY_ID,
    label: t('settings.seedingPolicy.attached', {
      name: matchedLabel ?? policyLabel(attached, t('settings.seedingPolicy.custom')),
    }),
    definition: { [POLICY_TYPE_SEEDING]: attached },
    source: 'attached',
  };
}

/**
 * The seed counts a policy produces, as `drawSize → seedsCount` pairs.
 *
 * The whole point of attaching a federation's policy is a different depth of seeding, and that
 * difference is invisible in a policy's name. Surfacing the table is what lets an operator see that
 * the thing they just attached actually seeds 16 in a 32 draw.
 */
export function describeThresholds(policy: Record<string, any> | null | undefined): string[] {
  const thresholds = policy?.seedsCountThresholds;
  if (!Array.isArray(thresholds) || !thresholds.length) return [];
  return [...thresholds]
    .sort((a, b) => (a?.drawSize ?? 0) - (b?.drawSize ?? 0))
    .map((threshold) => `${threshold?.drawSize ?? '?'} → ${threshold?.seedsCount ?? 0}`);
}
