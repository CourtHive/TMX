/**
 * Wires the navbar provider badge click handler and resolves the initial
 * active-provider context.
 *
 * Two cohorts get the click-to-switch affordance:
 *   - Super-admins: can impersonate any provider (existing behavior).
 *   - Any user with N>1 provider associations: can switch among the
 *     providers they're associated with via user_providers (new — see
 *     Mentat/planning/MULTI_PROVIDER_SESSION_CONTEXT.md).
 *
 * Boot-path resolution: for any user with provider associations, the
 * active provider is set on boot via `resolveInitialProvider()` so the
 * calendar + branding reflect the right context from the first render.
 * Super-admins fall back to the legacy localStorage-only path when they
 * have no user_providers rows (they can be associated with zero providers
 * and still impersonate anything in the system).
 */
import {
  setActiveProvider,
  readPersistedProvider,
  getActiveProvider,
  getProviderAssociations,
  resolveInitialProvider,
} from './providerState';
import { openProviderSwitcher } from 'components/popovers/providerSwitcher';
import { getLoginState } from 'services/authentication/loginState';
import { context } from 'services/context';

import { SUPER_ADMIN, TMX_TOURNAMENTS } from 'constants/tmxConstants';

let providerClickWired = false;

function isSuperAdmin(): boolean {
  return !!getLoginState()?.roles?.includes(SUPER_ADMIN);
}

function hasMultipleAssociations(): boolean {
  return getProviderAssociations().length > 1;
}

function shouldOpenSwitcher(): boolean {
  // Super-admins always; everyone else only when they have more than one
  // association to switch among. Single-provider users get a read-only
  // badge.
  return isSuperAdmin() || hasMultipleAssociations();
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
      if (shouldOpenSwitcher() && onTournamentsRoute()) {
        openProviderSwitcher({ target: providerEl });
        return;
      }
      context.router?.navigate(`/${TMX_TOURNAMENTS}`);
    });
  }

  if (providerEl && shouldOpenSwitcher()) {
    providerEl.style.cursor = 'pointer';
    providerEl.title = 'Switch provider';
  }

  // Boot-path resolution. For multi-provider users we honor the 4-level
  // precedence (localStorage → server lastSelectedProviderId → legacy
  // provider_id → first alphabetical). For super-admins with zero
  // associations we fall back to the localStorage-only legacy path so
  // their cross-app impersonation handoff from /admin still works.
  if (!getActiveProvider()) {
    if (getProviderAssociations().length > 0) {
      const resolved = resolveInitialProvider();
      if (resolved) {
        // Boot-path restoration — don't echo back to the server, the value
        // we'd send is the one the server just gave us.
        setActiveProvider(resolved, { persistServer: false });
      }
    } else if (isSuperAdmin()) {
      const persisted = readPersistedProvider();
      if (persisted) setActiveProvider(persisted, { persistServer: false });
    }
  }
}
