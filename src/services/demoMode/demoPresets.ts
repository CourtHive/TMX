/**
 * Named lockdown postures for demonstration.
 *
 * A preset **sets the checkboxes** — it is not a second code path. Selecting one
 * computes an overlay from `ALLOWED_BY_PRESET` and stores it exactly as if the
 * operator had ticked each box by hand, so there is nothing a preset can express
 * that the raw grid cannot, and nothing to diverge.
 *
 * Names come from the role research in
 * `Mentat/planning/TMX_LOCKDOWN_AND_ROLE_MODEL.md` §2 — `RECORDER` is the
 * "authority over the record, none over play" position that tennis staffs
 * everywhere and names nowhere.
 */
import { BOOLEAN_PERMISSION_KEYS } from '@courthive/provider-config';

import type { ProviderPermissions } from '@courthive/provider-config';
import type { DemoPermissionOverride } from './demoState';

export type DemoPresetId = 'providerDefaults' | 'recorder' | 'scheduler' | 'registrar' | 'director' | 'readOnly';

type Key = keyof ProviderPermissions;

/** What each preset LEAVES ON. Everything else is switched off. */
const ALLOWED_BY_PRESET: Record<Exclude<DemoPresetId, 'providerDefaults'>, Key[]> = {
  // The empty cell: may write the record, may do nothing else.
  recorder: ['canEnterScores', 'canUseChat'],
  scheduler: [
    'canModifySchedule',
    'canUseBulkScheduling',
    'canModifyCourtAvailability',
    'canEnterScores',
    'canUseChat',
  ],
  registrar: [
    'canCreateCompetitors',
    'canModifyEntries',
    'canEditParticipantDetails',
    'canImportParticipants',
    'canUseChat',
  ],
  director: BOOLEAN_PERMISSION_KEYS.filter(
    (key) => !(['canAccessProviderAdmin', 'canModifyCompletedScores', 'canModifyPolicies'] as string[]).includes(key),
  ) as Key[],
  readOnly: [],
};

export const DEMO_PRESET_IDS: readonly DemoPresetId[] = [
  'providerDefaults',
  'recorder',
  'scheduler',
  'registrar',
  'director',
  'readOnly',
];

/**
 * The overrides a preset implies.
 *
 * `providerDefaults` returns `undefined` — it REMOVES the overlay rather than
 * switching everything on. Those differ: an all-on overlay is still a layer,
 * and would mask a capability the provider itself has disabled.
 */
export function overridesForPreset(preset: DemoPresetId): DemoPermissionOverride | undefined {
  if (preset === 'providerDefaults') return undefined;
  const allowed = new Set<string>(ALLOWED_BY_PRESET[preset]);
  const overrides: DemoPermissionOverride = {};
  for (const key of BOOLEAN_PERMISSION_KEYS) {
    if (!allowed.has(key)) overrides[key as Key] = false;
  }
  return overrides;
}
