/**
 * The caller's scoped grants for the loaded tournament, and the mask built from
 * them.
 *
 * ## Cache the index, never the decision
 *
 * Grants are stored as a **fact** and the mask is derived from them; the
 * resource is still evaluated on every call. A cached decision goes stale when
 * the posture changes, whereas a mask keyed on the grant set cannot — which is
 * what lets this be called inside a Tabulator cell formatter without recomputing
 * anything per row.
 *
 * ## Empty means unrestricted
 *
 * No grants is NOT "restricted to nothing". It means this subject holds no
 * scoped grants and is unrestricted by this mechanism — the same conclusion the
 * server gate reaches, and the same thing `/factory/my-grants` returns when the
 * grants table has not been migrated yet.
 *
 * ## This mirrors server logic, deliberately and temporarily
 *
 * `isResourceInScope` reimplements `grantScope.ts` in
 * competition-factory-server. Two copies of one predicate is exactly the
 * divergence risk the ecosystem standards warn about, and the correct home is
 * `@courthive/provider-config`, which both repos already import — the same
 * argument that put `MUTATION_PERMISSIONS` there. That extraction is deliberately
 * NOT bundled here: it is a publish cascade across six consumers, and this
 * module is written to make the move mechanical. Until then the server remains
 * authoritative; the worst a divergence causes is a control offered and then
 * refused, never one wrongly permitted.
 */
import { grantCoversCapability, isTargetInScope } from '@courthive/provider-config';

import type { GrantScope, ProviderPermissions, ScopeTarget } from '@courthive/provider-config';

export type { GrantScope, ScopeKey, ScopeTarget } from '@courthive/provider-config';

export type CallerGrant = {
  /** A ProviderPermissions key, or '*' for a full grant narrowed only by scope. */
  capability: string;
  scope: GrantScope;
};

let grants: CallerGrant[] = [];
let version = 0;

export function setCallerGrants(next: CallerGrant[] | undefined): void {
  grants = Array.isArray(next) ? next : [];
  version += 1;
}

export function getCallerGrants(): readonly CallerGrant[] {
  return grants;
}

/** True when this subject holds no scoped grants — i.e. unrestricted. */
export function isScopeUnrestricted(): boolean {
  return grants.length === 0;
}

export function scopeVersion(): number {
  return version;
}

export function clearCallerGrants(): void {
  setCallerGrants([]);
}

/**
 * May the caller exercise `key` on `resource`?
 *
 * Unrestricted when no grants are held. Otherwise at least one grant must cover
 * both the capability and the resource — holding a Court-7 scoring grant is a
 * statement about where you may score, so anywhere else is refused.
 */
export function isPermittedOnResource(key: keyof ProviderPermissions, resource: ScopeTarget): boolean {
  if (isScopeUnrestricted()) return true;
  return grants.some((grant) => grantCoversCapability(grant.capability, key) && isTargetInScope(grant.scope, resource));
}
