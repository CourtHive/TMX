/**
 * Multi-provider user context — fetched from `GET /auth/me` and cached in memory.
 *
 * This is the TMX-side mirror of the server's `userContext` middleware.
 * Global capability roles come from the JWT via `getLoginState()`;
 * provider-scoped roles (PROVIDER_ADMIN, DIRECTOR) come from this context
 * because they're resolved from `user_providers` at request time, not
 * baked into the JWT.
 *
 * Usage:
 *   const ctx = getUserContext();              // synchronous read of cached value
 *   const ctx = await fetchUserContext();      // force refresh from server
 *   const ctx = await ensureUserContext();     // fetch if not yet cached
 *
 * The cache is cleared on logout and on login (so the new user's context
 * is fetched fresh).
 */
import { baseApi } from 'services/apis/baseApi';

import type { UserContext } from 'types/tmx';

let cached: UserContext | undefined;

/** Synchronous read of the cached user context. Returns undefined if not yet fetched. */
export function getUserContext(): UserContext | undefined {
  return cached;
}

/** Fetch the user context from the server and update the cache. */
export async function fetchUserContext(): Promise<UserContext | undefined> {
  try {
    const response = await baseApi.get('/auth/me');
    if (response?.data?.userId) {
      cached = response.data as UserContext;
      return cached;
    }
  } catch {
    // Not logged in, or server unreachable — clear the cache
  }
  cached = undefined;
  return undefined;
}

/** Return the cached context if available, or fetch it. */
export async function ensureUserContext(): Promise<UserContext | undefined> {
  if (cached) return cached;
  return fetchUserContext();
}

/** Clear the cached context. Called on logout and login transitions. */
export function clearUserContext(): void {
  cached = undefined;
}

// ── Convenience queries ──

/** Is the current user a PROVIDER_ADMIN at the given provider? */
export function isProviderAdmin(providerId: string): boolean {
  return cached?.providerRoles?.[providerId] === 'PROVIDER_ADMIN';
}

/** Does the current user have any association with the given provider? */
export function hasProviderAccess(providerId: string): boolean {
  return !!cached?.providerRoles?.[providerId];
}

/** All provider IDs the current user is associated with. */
export function getProviderIds(): string[] {
  return cached?.providerIds ?? [];
}
