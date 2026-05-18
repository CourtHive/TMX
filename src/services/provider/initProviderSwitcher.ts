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
import { context } from 'services/context';

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
    // Single consolidated click handler. Per-page `onclick = navigate`
    // setters were removed to eliminate the race that caused the popover
    // to open during navigation back to /tournaments.
    providerEl.addEventListener('click', () => {
      if (isSuperAdmin() && onTournamentsRoute()) {
        openProviderSwitcher({ target: providerEl });
        return;
      }
      context.router?.navigate(`/${TMX_TOURNAMENTS}`);
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
