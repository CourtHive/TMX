/**
 * Single source of truth for "is the current user an admin for the active
 * provider?" — replaces scattered `roles.includes(ADMIN)` checks.
 *
 * Resolution (any one grants admin for the currently active provider):
 *   1. super-admin (global role) — admin everywhere
 *   2. PROVISIONER managing the active provider (login `provisionerProviders`)
 *   3. PROVIDER_ADMIN at the active provider (login `providerAssociations`)
 *
 * The deprecated global `admin` role no longer grants provider admin. The
 * server retired the same shim (competition-factory-server#1015, 2026-10-07)
 * and decides from user_providers rows alone, so honoring it here would offer
 * controls the server refuses.
 *
 * The active provider is the impersonated one (`context.provider`) when set,
 * otherwise the JWT home provider (`state.provider`).
 */
import { resolveActiveProvider } from 'services/provider/resolveActiveProvider';
import { getLoginState } from 'services/authentication/loginState';
import { context } from 'services/context';

// constants and types
import { SUPER_ADMIN, PROVIDER_ADMIN } from 'constants/tmxConstants';

export function isActiveProviderAdmin(): boolean {
  const state = getLoginState();
  if (!state) return false;
  if (state.roles?.includes(SUPER_ADMIN)) return true;

  const activeId = resolveActiveProvider(state, context.provider)?.organisationId;
  if (!activeId) return false;
  if (state.provisionerProviders?.some((p) => p.providerId === activeId)) return true;
  const association = state.providerAssociations?.find((a) => a.providerId === activeId);
  return association?.providerRole === PROVIDER_ADMIN;
}
