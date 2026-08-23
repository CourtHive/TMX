/**
 * Which provider permissions TMX actually enforces — and which are decorative.
 *
 * `ProviderPermissions` declares far more keys than TMX consumes. Several are
 * surfaced as togglable in the courthive-ams provider editor while gating
 * nothing anywhere, so an operator can switch a capability "off" and watch
 * nothing happen. This module answers, per key, *where* a gate exists:
 *
 *   'both'     — a UI affordance hides/disables, AND the mutation gate rejects
 *   'ui'       — the control is hidden, but the mutation itself is ungated
 *   'mutation' — the mutation is rejected, but the control is still offered
 *                (the button-that-errors shape)
 *   'none'     — declared and enforced nowhere; toggling it changes nothing
 *
 * The demo-mode simulator depends on this: a panel that renders a checkbox for
 * a key with no gate would lie to whoever is being demonstrated to. It must be
 * able to say "no gate implemented" rather than imply a restriction it cannot
 * apply.
 *
 * `MUTATION_ENFORCED` is derived at runtime from the shared map, so it can
 * never drift. `UI_ENFORCED` cannot be — call sites are arbitrary code — so it
 * is hand-maintained and **pinned by a test that scans `src/`**. If you add or
 * remove an `isAllowed(...)` gate, that test fails until this set matches.
 */
import { BOOLEAN_PERMISSION_KEYS, MUTATION_PERMISSIONS } from '@courthive/provider-config';

import type { ProviderPermissions } from '@courthive/provider-config';

export type PermissionKey = keyof ProviderPermissions;
export type CoverageBadge = 'both' | 'ui' | 'mutation' | 'none';

/**
 * Keys gated by a UI affordance in `src/` via `providerConfig.isAllowed(...)`.
 *
 * Hand-maintained by necessity; kept honest by `capabilityCoverage.test.ts`,
 * which scans the source tree and fails on any drift in either direction.
 */
export const UI_ENFORCED: ReadonlySet<PermissionKey> = new Set<PermissionKey>([
  'canUseChat',
  'canCreateEvents',
  'canDeleteEvents',
  'canCreateVenues',
  'canDeleteVenues',
  'canCreateOfficials',
  'canCreateCompetitors',
  'canDeleteParticipants',
  'canImportParticipants',
  'canUseBulkScheduling',
  'canUseDraftPositioning',
  'canUseManualPositioning',
]);

/** Derived from the shared mutation map — never hand-maintained. */
export const MUTATION_ENFORCED: ReadonlySet<PermissionKey> = new Set(
  Object.values(MUTATION_PERMISSIONS) as PermissionKey[],
);

/** Where, if anywhere, this permission is enforced in TMX. */
export function coverageFor(key: PermissionKey): CoverageBadge {
  const ui = UI_ENFORCED.has(key);
  const mutation = MUTATION_ENFORCED.has(key);
  if (ui && mutation) return 'both';
  if (ui) return 'ui';
  if (mutation) return 'mutation';
  return 'none';
}

/**
 * Boolean permission keys that gate nothing at all. A non-empty result is not a
 * failure — it is the honest current state, and the demo panel renders these
 * with a "no gate implemented" warning rather than a working-looking checkbox.
 */
export function unenforcedPermissionKeys(): PermissionKey[] {
  return (BOOLEAN_PERMISSION_KEYS as readonly PermissionKey[]).filter((key) => coverageFor(key) === 'none');
}

/** The full report, one row per boolean permission key. */
export function capabilityCoverageReport(): { key: PermissionKey; coverage: CoverageBadge }[] {
  return (BOOLEAN_PERMISSION_KEYS as readonly PermissionKey[]).map((key) => ({ key, coverage: coverageFor(key) }));
}
