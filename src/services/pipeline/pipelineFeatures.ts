/**
 * Pipeline features — configure the factory's exit-propagation options from Settings, for testing.
 *
 * CA, 2026-10-15: a panel under Beta features, *"only on when not logged in or when a tournamentRecord has the
 * 'isMock' flag"*; *"a previously attached scoring policy disables the settings panel"*; and mock tournaments run
 * locally while it is in use, so results computed under modified rules never reach the server.
 *
 * Two layers, because the factory reads the options in two places:
 *
 * - **Per call** (`propagateExitStatus`, `propagateRetirementAsExit`, `allowChangePropagation`,
 *   `disableScoreValidation`): merged into every `setMatchUpStatus` that passes through `mutationRequest`. The
 *   factory resolves the first three as `policy ?? param ?? default`, so a per-call value only counts where no
 *   scoring policy speaks — which is exactly why a tournament's own scoring policy turns the panel off.
 * - **Attached policy** (`scoring.requireParticipantsForScoring`, `progression.*`): these are never read from the
 *   call, so the panel attaches a policy to the tournament, built on the factory default and marked by
 *   `PIPELINE_POLICY_NAME` so it can always be told apart from a policy the tournament came with.
 *
 * Everything here is pure (no DOM, no engine) so the gate and the injection are unit-tested directly.
 */
import { SET_MATCHUP_STATUS, ATTACH_POLICIES, REMOVE_POLICY } from 'constants/mutationConstants';
import { extensionConstants, fixtures, policyConstants } from 'tods-competition-factory';
import { PIPELINE_CALL_KEYS } from 'config/pipelineConfig';

import type { PipelineCallOverrides, PipelineSetting } from 'config/pipelineConfig';
import type { MutationMethod } from 'types/services';

const { POLICY_TYPE_SCORING, POLICY_TYPE_PROGRESSION } = policyConstants;
const { APPLIED_POLICIES } = extensionConstants;

/** The `policyName` on every policy this panel attaches. */
export const PIPELINE_POLICY_NAME = 'TMX Pipeline Features';

export const PIPELINE_POLICY_KEYS = {
  [POLICY_TYPE_SCORING]: ['requireParticipantsForScoring'],
  [POLICY_TYPE_PROGRESSION]: [
    'doubleExitPropagateBye',
    'autoPlaceQualifiers',
    'autoReplaceQualifiers',
    'autoRemoveQualifiers',
  ],
} as const;

export type PipelinePolicyType = keyof typeof PIPELINE_POLICY_KEYS;
export type PipelinePolicySettings = Record<string, PipelineSetting>;

const FACTORY_DEFAULTS: Record<string, any> = {
  [POLICY_TYPE_SCORING]: fixtures.policies.POLICY_SCORING_DEFAULT[POLICY_TYPE_SCORING],
  [POLICY_TYPE_PROGRESSION]: fixtures.policies.POLICY_PROGRESSION_DEFAULT[POLICY_TYPE_PROGRESSION],
};

// ── Where policies sit on a record ──

function appliedPolicies(element: any): Record<string, any> | undefined {
  return element?.extensions?.find((extension: any) => extension?.name === APPLIED_POLICIES)?.value;
}

/** Every policy of `policyType` on the record, at tournament, event and draw level. */
function policiesOfType(record: any, policyType: string): any[] {
  const elements = [record];
  for (const event of record?.events ?? []) {
    elements.push(event);
    elements.push(...(event?.drawDefinitions ?? []));
  }
  return elements.map((element) => appliedPolicies(element)?.[policyType]).filter(Boolean);
}

/** A policy of this type that the panel did not attach — the tournament's own rules. */
export function hasForeignPolicy(record: any, policyType: string): boolean {
  return policiesOfType(record, policyType).some((policy) => policy?.policyName !== PIPELINE_POLICY_NAME);
}

/** The policy of this type the panel attached to the tournament, if any. */
export function pipelinePolicy(record: any, policyType: string): any {
  const policy = appliedPolicies(record)?.[policyType];
  return policy?.policyName === PIPELINE_POLICY_NAME ? policy : undefined;
}

// ── The gate ──

/** Logged out, or a mocksEngine tournament (`isMock: true`, set by default on every generated record). */
export function isPipelineEligible(record: any, loggedIn: boolean): boolean {
  return !loggedIn || record?.isMock === true;
}

/** Eligible, and no scoring policy of the tournament's own — one speaks over the per-call options. */
export function isPipelineActive(record: any, loggedIn: boolean): boolean {
  return !!record && isPipelineEligible(record, loggedIn) && !hasForeignPolicy(record, POLICY_TYPE_SCORING);
}

// ── Per-call injection ──

const toBoolean = (setting: PipelineSetting): boolean | undefined =>
  setting === 'on' ? true : setting === 'off' ? false : undefined;

/** The `setMatchUpStatus` params the panel overrides; empty when everything is `default`. */
export function callOverrideParams(overrides: Readonly<PipelineCallOverrides>): Record<string, boolean> {
  const params: Record<string, boolean> = {};
  for (const key of PIPELINE_CALL_KEYS) {
    const value = toBoolean(overrides[key]);
    if (value !== undefined) params[key] = value;
  }
  return params;
}

/** Merge the overrides into every `setMatchUpStatus`, OVER what the call path set: `off` must beat a path's `true`. */
export function applyPipelineOverrides(methods: MutationMethod[], params: Record<string, boolean>): MutationMethod[] {
  if (!Object.keys(params).length) return methods;
  return methods.map((m) => (m.method === SET_MATCHUP_STATUS ? { ...m, params: { ...m.params, ...params } } : m));
}

// ── Attached policies ──

/** The tri-state each policy option reads as on this record. */
export function readPolicySettings(record: any, policyType: PipelinePolicyType): PipelinePolicySettings {
  const policy = pipelinePolicy(record, policyType);
  const settings: PipelinePolicySettings = {};
  for (const key of PIPELINE_POLICY_KEYS[policyType]) {
    const value = policy?.[key];
    const isDefault = !policy || value === undefined || value === FACTORY_DEFAULTS[policyType]?.[key];
    settings[key] = isDefault ? 'default' : value ? 'on' : 'off';
  }
  return settings;
}

/**
 * The mutation that makes the record carry `settings` for this policy type: attach the marked policy (the
 * factory default with the chosen values over it), or remove it once every option is back to `default`.
 */
export function policyMutation(
  record: any,
  policyType: PipelinePolicyType,
  settings: PipelinePolicySettings,
): MutationMethod | undefined {
  const chosen = Object.entries(settings).filter(([, setting]) => setting !== 'default');
  if (!chosen.length) {
    return pipelinePolicy(record, policyType) ? { method: REMOVE_POLICY, params: { policyType } } : undefined;
  }
  const policy = { ...FACTORY_DEFAULTS[policyType], policyName: PIPELINE_POLICY_NAME };
  for (const [key, setting] of chosen) policy[key] = setting === 'on';
  return { method: ATTACH_POLICIES, params: { policyDefinitions: { [policyType]: policy }, allowReplacement: true } };
}

// ── Local execution and the badge ──

/** Whether anything the panel controls differs from the default on this record. */
export function isPipelineModified(record: any, overrides: Readonly<PipelineCallOverrides>): boolean {
  if (Object.keys(callOverrideParams(overrides)).length) return true;
  return Object.keys(PIPELINE_POLICY_KEYS).some((policyType) => !!pipelinePolicy(record, policyType));
}

/** A mutation that attaches the panel's own marked policy. */
function attachesPipelinePolicy(method: MutationMethod): boolean {
  if (method.method !== ATTACH_POLICIES) return false;
  const definitions = method.params?.policyDefinitions ?? {};
  return Object.values(definitions).some((policy: any) => policy?.policyName === PIPELINE_POLICY_NAME);
}

/**
 * A mock tournament runs locally while the panel is in use: results under modified rules must not reach the
 * server. Read from the record BEFORE the mutation, so the call that removes the panel's last policy stays local;
 * the call that attaches its first one is recognised by its marker.
 */
export function pipelineForcesLocal(
  record: any,
  overrides: Readonly<PipelineCallOverrides>,
  active: boolean,
  methods: MutationMethod[] = [],
): boolean {
  if (!active || record?.isMock !== true) return false;
  return isPipelineModified(record, overrides) || methods.some(attachesPipelinePolicy);
}
