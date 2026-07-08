/**
 * Shared scheduling-policy selection logic for the Apply Times / Apply Grid
 * modals.
 *
 * Three concerns live here so the two modals cannot drift apart:
 *
 *  1. Identity stamping — a catalog policy is attached with a `policyName`
 *     stamped into its data, so the identity travels with the tournamentRecord
 *     and later re-opens can match it independently of structural drift.
 *  2. Normalized compare — a stopgap fallback for policies attached before
 *     identity stamping existed. Tolerates key ordering/formatting but NOT the
 *     addition/removal of fields (a genuinely different shape stays "Custom").
 *  3. The "Attached" entry — a first-class, selectable option representing the
 *     policy already on the tournament, so re-applying it is a clean no-op
 *     rather than a forced re-attach.
 *
 * Creating/editing scheduling policies is out of scope — that lives on the
 * `/policies` page and persists through `policyBridge`.
 */
import { competitionEngine } from 'services/factory/engine';
import { PolicyCatalogItem } from 'courthive-components';

import { getBuiltinPolicies, loadUserPolicies } from 'pages/policies/policyBridge';

export const POLICY_TYPE_SCHEDULING = 'scheduling';
/** Sentinel id for the synthetic "Attached" entry (the policy already on the
 *  tournamentRecord). Selecting it never re-attaches. */
export const ATTACHED_POLICY_ID = '__attached__';

export type PolicySource = 'builtin' | 'user' | 'attached';

export interface PolicyChoice {
  id: string;
  label: string;
  /** attachPolicies({ policyDefinitions }) input shape: `{ scheduling: {...} }`. */
  definition: Record<string, any>;
  source: PolicySource;
}

/** Identity/volatile keys ignored by the structural compare. `policyName` is
 *  identity (matched separately); ignoring it here means stamping it onto a
 *  catalog choice never perturbs the structural fallback. */
const IGNORED_COMPARE_KEYS = new Set(['policyName']);

function stableStringify(value: any): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value)
      .filter((k) => !IGNORED_COMPARE_KEYS.has(k))
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Key-sorted serialization that ignores identity keys — stopgap replacement
 *  for exact JSON.stringify matching. Two policies that differ only in key
 *  order (or in `policyName`) compare equal; a different set of fields does not. */
export function normalizedFingerprint(policy: Record<string, any> | undefined | null): string {
  if (!policy || typeof policy !== 'object') return '';
  return stableStringify(policy);
}

/** The identity token for a catalog item: an explicit `policyName` embedded in
 *  the data, else the catalog display name. */
export function choiceIdentity(item: PolicyCatalogItem): string {
  const embedded = (item.policyData as any)?.policyName;
  return typeof embedded === 'string' && embedded ? embedded : item.name;
}

/** attachPolicies definition for a catalog item, with the identity stamped in
 *  so it travels with the tournamentRecord once attached. */
export function toDefinition(item: PolicyCatalogItem): Record<string, any> {
  return { [POLICY_TYPE_SCHEDULING]: { ...item.policyData, policyName: choiceIdentity(item) } };
}

export function toChoice(item: PolicyCatalogItem): PolicyChoice {
  return {
    id: item.id,
    label: item.name,
    definition: toDefinition(item),
    source: item.source === 'builtin' ? 'builtin' : 'user',
  };
}

/** The scheduling policy currently attached to the (active) tournament, or null. */
export function getAttachedSchedulingPolicy(): Record<string, any> | null {
  try {
    const result: any = competitionEngine.findPolicy?.({ policyType: POLICY_TYPE_SCHEDULING });
    return result?.policy ?? null;
  } catch {
    return null;
  }
}

/** Load the scheduling policies registered with the `/policies` page: factory
 *  built-ins plus any user policies persisted to IndexedDB. */
export async function loadSchedulingChoices(): Promise<PolicyChoice[]> {
  const builtins = getBuiltinPolicies().filter((p) => p.policyType === POLICY_TYPE_SCHEDULING);
  let userPolicies: PolicyCatalogItem[] = [];
  try {
    const all = await loadUserPolicies();
    userPolicies = all.filter((p) => p.policyType === POLICY_TYPE_SCHEDULING);
  } catch (err) {
    console.error('loadUserPolicies failed', err);
  }
  return [...builtins.map(toChoice), ...userPolicies.map(toChoice)];
}

/** Resolve which catalog choice (if any) equals the attached policy. Identity
 *  (`policyName`) match first; structural normalized compare as fallback. */
export function resolveAttachedChoiceId(
  attached: Record<string, any> | null,
  choices: PolicyChoice[],
): string | null {
  if (!attached) return null;

  const attachedName = typeof attached.policyName === 'string' ? attached.policyName : '';
  if (attachedName) {
    const byName = choices.find((c) => (c.definition[POLICY_TYPE_SCHEDULING]?.policyName ?? '') === attachedName);
    if (byName) return byName.id;
  }

  const attachedFp = normalizedFingerprint(attached);
  if (!attachedFp) return null;
  const byShape = choices.find((c) => normalizedFingerprint(c.definition[POLICY_TYPE_SCHEDULING]) === attachedFp);
  return byShape?.id ?? null;
}

/** First-class entry for the policy already attached to the tournament.
 *  `matchedLabel` is the catalog label when the attached policy resolves to a
 *  known choice, else null (shown as its `policyName` or "Custom policy"). */
export function buildAttachedChoice(attached: Record<string, any>, matchedLabel: string | null): PolicyChoice {
  const name =
    matchedLabel ?? (typeof attached.policyName === 'string' && attached.policyName ? attached.policyName : 'Custom policy');
  return {
    id: ATTACHED_POLICY_ID,
    label: `Attached — ${name}`,
    definition: { [POLICY_TYPE_SCHEDULING]: attached },
    source: 'attached',
  };
}

/** Append a labelled `<optgroup>` for one source, containing only choices from
 *  that source. Empty groups are skipped so the select shows no empty header. */
export function appendChoiceGroup(
  select: HTMLSelectElement,
  label: string,
  choices: PolicyChoice[],
  source: PolicySource,
  selectedId: string,
): void {
  const filtered = choices.filter((c) => c.source === source);
  if (!filtered.length) return;
  const group = document.createElement('optgroup');
  group.label = label;
  for (const choice of filtered) {
    const opt = document.createElement('option');
    opt.value = choice.id;
    opt.textContent = choice.label;
    if (choice.id === selectedId) opt.selected = true;
    group.appendChild(opt);
  }
  select.appendChild(group);
}
