import { validateToken } from 'services/authentication/validateToken';
import { getToken, removeToken, setToken } from './tokenManagement';

import { disconnectSocket } from 'services/messaging/socketIo';
import { tournamentEngine } from 'tods-competition-factory';
import { loginModal } from 'components/modals/loginModal';
import { tmxToast } from 'services/notifications/tmxToast';
import { tipster } from 'components/popovers/tipster';
import { checkDevState } from './checkDevState';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';
import { t } from 'i18n';

import type { LoginState } from 'types/tmx';

import { SUPER_ADMIN, ADMIN, TMX_TOURNAMENTS } from 'constants/tmxConstants';

export function styleLogin(valid: LoginState | undefined | false): void {
  const el = document.getElementById('login');
  const impersonating = context?.provider;
  const admin = valid && valid.roles?.includes(SUPER_ADMIN);
  if (!el) return;
  if (!valid) {
    el.style.color = '';
  } else {
    el.style.color = (impersonating && 'var(--tmx-accent-red)') || (admin && 'var(--tmx-accent-green)') || 'var(--tmx-accent-blue)';
  }
}

export function getLoginState(): LoginState | undefined {
  const token = getToken();
  const valid = validateToken(token);
  if (valid) styleLogin(valid);
  return valid;
}

export function logOut(): void {
  removeToken();
  checkDevState();
  disconnectSocket();
  context.provider = undefined; // clear provider
  context.router?.navigate(`/${TMX_TOURNAMENTS}/logout`);
  styleLogin(false);
}

export function logIn({ data, callback }: { data: { token: string }; callback?: () => void }): void {
  const valid = validateToken(data.token);
  const tournamentInState = tournamentEngine.getTournament().tournamentRecord?.tournamentId;
  if (valid) {
    setToken(data.token);
    tmxToast({ intent: 'is-success', message: t('toasts.loggedIn') });
    disconnectSocket();
    if (!tournamentInState) tournamentEngine.reset();
    styleLogin(valid);
    if (isFunction(callback)) {
      callback();
    } else if (!tournamentInState) {
      context.router?.navigate(`/${TMX_TOURNAMENTS}/${valid.provider?.organisationAbbreviation ?? Date.now()}`);
    }
  }
}

export function cancelImpersonation(): void {
  context.provider = undefined;
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
          text: t('loginMenu.system'),
          hide: !superAdmin,
          onClick: () => context.router?.navigate('/system'),
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
