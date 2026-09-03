/**
 * Does the current user hold a GLOBAL admin role (`admin` or `superadmin`) from the JWT?
 *
 * Deliberately NOT {@link isActiveProviderAdmin}, which also answers true for a PROVIDER_ADMIN of
 * the active provider. Routes decorated `@Roles([ADMIN, SUPER_ADMIN])` on the server — the
 * participation read model among them — accept neither PROVIDER_ADMIN nor PROVISIONER, so gating a
 * link to one of those routes on provider-admin would show it to users who can only ever receive a
 * 403. Match the server's own predicate, or the client gate is decoration.
 */
import { getLoginState } from 'services/authentication/loginState';

import { ADMIN, SUPER_ADMIN } from 'constants/tmxConstants';

const GLOBAL_ADMIN_ROLES = new Set([ADMIN, SUPER_ADMIN]);

export function hasGlobalAdminRole(): boolean {
  const roles = getLoginState()?.roles;
  return !!roles?.some((role) => GLOBAL_ADMIN_ROLES.has(role));
}
