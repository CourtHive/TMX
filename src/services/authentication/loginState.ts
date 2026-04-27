import { renderSettingsTab } from 'pages/tournament/tabs/settingsTab/renderSettingsTab';
import { renderOverview } from 'pages/tournament/tabs/overviewTab/renderOverview';
import { initProviderSwitcher } from 'services/provider/initProviderSwitcher';
import { clearUserContext, fetchUserContext } from './getUserContext';
import { clearActiveProvider } from 'services/provider/providerState';
import { validateToken } from 'services/authentication/validateToken';
import { getToken, removeToken, setToken } from './tokenManagement';
import { disconnectSocket } from 'services/messaging/socketIo';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { loginModal } from 'components/modals/loginModal';
import { providerConfig } from 'config/providerConfig';
import { getLoginColor } from 'functions/getLoginColor';
import { tipster } from 'components/popovers/tipster';
import { checkDevState } from './checkDevState';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';
import { t } from 'i18n';

// types
import type { LoginState } from 'types/tmx';

// constants
import { SUPER_ADMIN, ADMIN, TMX_TOURNAMENTS, NONE } from 'constants/tmxConstants';

export function styleLogin(valid: LoginState | undefined | false): void {
  const el = document.getElementById('login');
  if (!el) return;
  el.style.color = getLoginColor({
    valid: !!valid,
    impersonating: !!context?.provider,
    isSuperAdmin: !!(valid && valid.roles?.includes(SUPER_ADMIN)),
  });
}

export function getLoginState(): LoginState | undefined {
  const token = getToken();
  const valid = validateToken(token);
  if (valid) {
    styleLogin(valid);
    // Apply effective provider config from the JWT on each load. Boot path
    // (existing valid token + page reload) reaches here without hitting
    // logIn(), so the apply must live here too. Default-permissive when
    // the field is absent (older token / no provider).
    if (valid.activeProviderConfig) providerConfig.set(valid.activeProviderConfig);
  }
  return valid;
}

export function logOut(): void {
  removeToken();
  clearUserContext();
  checkDevState();
  disconnectSocket();
  tournamentEngine.reset();
  clearActiveProvider();
  providerConfig.reset();
  context.matchUpFilters = {};
  context.router?.navigate(`/${TMX_TOURNAMENTS}/logout`);
  styleLogin(false);
}

export function logIn({ data, callback }: { data: { token: string }; callback?: () => void }): void {
  const valid = validateToken(data.token);
  const tournamentInState = tournamentEngine.getTournament().tournamentRecord?.tournamentId;
  if (valid) {
    setToken(data.token);
    clearUserContext();
    // Fire-and-forget: fetch the multi-provider user context from the server.
    // The context will be available by the time the user interacts with the
    // tournaments table or any provider-scoped UI element.
    fetchUserContext();
    if (valid.activeProviderConfig) providerConfig.set(valid.activeProviderConfig);
    tmxToast({ intent: 'is-success', message: t('toasts.loggedIn') });
    disconnectSocket();
    if (!tournamentInState) tournamentEngine.reset();
    styleLogin(valid);
    initProviderSwitcher();
    if (isFunction(callback)) {
      callback();
    } else if (!tournamentInState) {
      context.router?.navigate(`/${TMX_TOURNAMENTS}/${valid.provider?.organisationAbbreviation ?? Date.now()}`);
    }

    if (tournamentInState) {
      reRenderActiveTab();
    }
  }
}

function reRenderActiveTab(): void {
  const overviewTab = document.getElementById('o-tab');
  const settingsTab = document.getElementById('c-tab');

  if (overviewTab && overviewTab.style.display !== NONE) {
    renderOverview();
  } else if (settingsTab && settingsTab.style.display !== NONE) {
    renderSettingsTab();
  }
}

export function cancelImpersonation(): void {
  clearActiveProvider();
  // Re-apply the JWT user's home effective config when stopping impersonation.
  // For full correctness on impersonation switch (not stop) the provider
  // switcher fetches GET /provider/:id/effective-config — see
  // initProviderSwitcher.ts.
  const valid = getLoginState();
  if (valid?.activeProviderConfig) providerConfig.set(valid.activeProviderConfig);
  else providerConfig.reset();
  context.router?.navigate(`/${TMX_TOURNAMENTS}/superadmin`);
}

export function initLoginToggle(id: string): void {
  const el = document.getElementById(id);

  if (el) {
    el.addEventListener('click', () => {
      const loggedIn = getLoginState();
      const superAdmin = loggedIn?.roles?.includes(SUPER_ADMIN);
      const impersonating = context?.provider;

      const items = [
        {
          onClick: () => tmxToast({ message: 'TBD: Registration Modal' }),
          text: t('loginMenu.register'),
          hide: !!loggedIn,
        },
        {
          onClick: () => loginModal(),
          hide: !!loggedIn,
          text: t('loginMenu.logIn'),
        },
        {
          style: 'text-decoration: line-through;',
          hide: !superAdmin || !impersonating,
          onClick: cancelImpersonation,
          text: t('loginMenu.impersonate'),
        },
        {
          text: t('loginMenu.admin'),
          hide: !(superAdmin || (loggedIn?.roles?.includes(ADMIN) && context?.provider)),
          onClick: () => context.router?.navigate('/admin'),
        },
        {
          text: t('loginMenu.logOut'),
          hide: !loggedIn,
          onClick: logOut,
        },
      ];

      tipster({ target: el, title: t('loginMenu.authorization'), items });
    });
  }
}
