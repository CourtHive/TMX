/**
 * Single source of truth for "is the current user an admin for the active
 * provider?" — replaces scattered `roles.includes(ADMIN)` checks.
 *
 * Resolution (any one grants admin for the currently active provider):
 *   1. super-admin (global role) — admin everywhere
 *   2. PROVISIONER managing the active provider (login `provisionerProviders`)
 *   3. PROVIDER_ADMIN at the active provider (login `providerAssociations`)
 *   4. legacy global `admin` role — deprecated, honored only until the role is
 *      retired fleet-wide; scoped to "some provider is active" to match the
 *      prior behavior so removing the role is the only change users notice.
 *
 * The active provider is the impersonated one (`context.provider`) when set,
 * otherwise the JWT home provider (`state.provider`).
 */
import { getLoginState } from 'services/authentication/loginState';
import { context } from 'services/context';

// constants and types
import { SUPER_ADMIN, PROVIDER_ADMIN, ADMIN } from 'constants/tmxConstants';

export function isActiveProviderAdmin(): boolean {
  const state = getLoginState();
  if (!state) return false;
  if (state.roles?.includes(SUPER_ADMIN)) return true;

  const activeId = (context.provider ?? state.provider)?.organisationId;
  if (activeId) {
    if (state.provisionerProviders?.some((p) => p.providerId === activeId)) return true;
    const association = state.providerAssociations?.find((a) => a.providerId === activeId);
    if (association?.providerRole === PROVIDER_ADMIN) return true;
  }

  // Deprecated global `admin` role — remove once the legacy role is retired.
  return !!(state.roles?.includes(ADMIN) && activeId);
}
