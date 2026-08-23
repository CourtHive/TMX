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
import type { ProviderPermissions } from '@courthive/provider-config';

/** Scope dimensions — must match SCOPE_KEYS in the server's grantScope.ts. */
export const SCOPE_KEYS = [
  'eventIds',
  'drawIds',
  'structureIds',
  'venueIds',
  'courtIds',
  'scheduledDates',
  'matchUpIds',
] as const;

export type ScopeKey = (typeof SCOPE_KEYS)[number];
export type GrantScope = Partial<Record<ScopeKey, string[]>>;

export type CallerGrant = {
  /** A ProviderPermissions key, or '*' for a full grant narrowed only by scope. */
  capability: string;
  scope: GrantScope;
};

/** The resource a UI control would act on. */
export type ScopedResource = {
  matchUpId?: string;
  courtId?: string;
  scheduledDate?: string;
  eventId?: string;
  drawId?: string;
  structureId?: string;
  venueId?: string;
};

const RESOURCE_TO_SCOPE: Record<keyof ScopedResource, ScopeKey> = {
  matchUpId: 'matchUpIds',
  courtId: 'courtIds',
  scheduledDate: 'scheduledDates',
  eventId: 'eventIds',
  drawId: 'drawIds',
  structureId: 'structureIds',
  venueId: 'venueIds',
};

const SCOPE_KEY_SET: ReadonlySet<string> = new Set(SCOPE_KEYS);

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

/** Does a grant's capability cover this permission key? */
export function grantCoversCapability(capability: string, key: keyof ProviderPermissions): boolean {
  return capability === '*' || capability === key;
}

/**
 * Does `resource` fall inside `scope`?
 *
 * Every declared dimension must match. A dimension the resource cannot answer is
 * a **deny** — an unscheduled matchUp is not on Court 7 — and a scope carrying
 * an unrecognized key is refused rather than ignored. Both mirror the server.
 */
export function isResourceInScope(scope: GrantScope | undefined, resource: ScopedResource): boolean {
  if (!scope || !Object.keys(scope).length) return true; // tournament-wide
  if (!Object.keys(scope).every((key) => SCOPE_KEY_SET.has(key))) return false;

  for (const [key, allowed] of Object.entries(scope) as [ScopeKey, string[]][]) {
    if (!Array.isArray(allowed) || !allowed.length) continue;
    const field = (Object.keys(RESOURCE_TO_SCOPE) as (keyof ScopedResource)[]).find(
      (name) => RESOURCE_TO_SCOPE[name] === key,
    );
    const value = field ? resource[field] : undefined;
    if (!value) return false;
    if (!allowed.includes(value)) return false;
  }
  return true;
}

/**
 * May the caller exercise `key` on `resource`?
 *
 * Unrestricted when no grants are held. Otherwise at least one grant must cover
 * both the capability and the resource — holding a Court-7 scoring grant is a
 * statement about where you may score, so anywhere else is refused.
 */
export function isPermittedOnResource(key: keyof ProviderPermissions, resource: ScopedResource): boolean {
  if (isScopeUnrestricted()) return true;
  return grants.some(
    (grant) => grantCoversCapability(grant.capability, key) && isResourceInScope(grant.scope, resource),
  );
}
