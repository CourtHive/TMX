/**
 * Wires the navbar provider badge click handler and restores any persisted
 * impersonation context from localStorage. Super-admins only.
 *
 * Called on app boot and after a successful login so the localStorage key
 * (`tmx_impersonated_provider`) written by the admin-client app or by a
 * previous TMX session is picked up automatically.
 */
import { setActiveProvider, readPersistedProvider, getActiveProvider } from './providerState';
import { openProviderSwitcher } from 'components/popovers/providerSwitcher';
import { getLoginState } from 'services/authentication/loginState';

import { SUPER_ADMIN, TMX_TOURNAMENTS } from 'constants/tmxConstants';

let providerClickWired = false;

function isSuperAdmin(): boolean {
  return !!getLoginState()?.roles?.includes(SUPER_ADMIN);
}

function onTournamentsRoute(): boolean {
  // Navigo uses hash routes prefixed with `#/`. The tournaments page sits at
  // `#/tournaments` and `#/tournaments/:uuid`.
  const hash = globalThis.location?.hash ?? '';
  return hash === `#/${TMX_TOURNAMENTS}` || hash.startsWith(`#/${TMX_TOURNAMENTS}/`);
}

export function initProviderSwitcher(): void {
  const providerEl = document.getElementById('provider');
  if (providerEl && !providerClickWired) {
    providerClickWired = true;
    providerEl.addEventListener('click', () => {
      if (!isSuperAdmin()) return;
      // The same element also acts as a "go to tournaments" button on every
      // other route (handler set by `tournamentHeader.ts`). Only present the
      // switch-provider menu when we're already viewing the tournaments page
      // — clicking-to-navigate-back-here shouldn't also open the popover.
      if (!onTournamentsRoute()) return;
      openProviderSwitcher({ target: providerEl });
    });
  }

  if (providerEl && isSuperAdmin()) {
    providerEl.style.cursor = 'pointer';
    providerEl.title = 'Switch provider';
  }

  if (isSuperAdmin() && !getActiveProvider()) {
    const persisted = readPersistedProvider();
    if (persisted) setActiveProvider(persisted);
  }
}
