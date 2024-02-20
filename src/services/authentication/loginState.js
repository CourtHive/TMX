import { validateToken } from 'services/authentication/validateToken';
import { getToken, removeToken, setToken } from './tokenManagement';
import { disconnectSocket } from 'services/messaging/socketIo';
import { tournamentEngine } from 'tods-competition-factory';
import { loginModal } from 'components/modals/loginModal';
import { selectItem } from 'components/modals/selectItem';
import { tmxToast } from 'services/notifications/tmxToast';
import { getProviders } from 'services/apis/servicesApi';
import { tipster } from 'components/popovers/tipster';
import { checkDevState } from './checkDevState';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

import { SUPER_ADMIN, TMX_TOURNAMENTS } from 'constants/tmxConstants';

export function getLoginState() {
  const token = getToken();
  const el = document.getElementById('login');
  const valid = validateToken(token);
  if (valid) {
    const impersonating = context?.provider;
    const admin = valid?.roles?.includes(SUPER_ADMIN);
    el.style.color = (impersonating && 'red') || (admin && 'green') || 'blue';
  }
  return valid;
}

export function logOut() {
  removeToken();
  checkDevState();
  disconnectSocket();
  context.provider = undefined; // clear provider
  context.router.navigate(`/${TMX_TOURNAMENTS}`);
  const el = document.getElementById('login');
  el.style.color = '';
}

export function logIn({ data, callback }) {
  const decodedToken = validateToken(data.token);
  if (decodedToken) {
    setToken(data.token);
    tmxToast({ intent: 'is-success', message: 'Login successful' });
    disconnectSocket();
    tournamentEngine.reset();
    if (isFunction(callback)) callback();
    context.router.navigate(`/${TMX_TOURNAMENTS}`);
  }
}

export function impersonate() {
  getProviders().then(({ data }) => {
    const options = data?.providers?.map(({ value }) => {
      return {
        onClick: () => {
          context.provider = value;
          context.router.navigate(`/${TMX_TOURNAMENTS}/${value.organisationAbbreviation}`);
        },
        participantName: value.organisationName,
      };
    });

    if (options) {
      selectItem({ title: 'Select Provider', options, selectionLimit: 1 });
    }
  });
}

export function cancelImpersonation() {
  context.provider = undefined;
  context.router.navigate(`/${TMX_TOURNAMENTS}/superadmin`);
}

export function initLoginToggle() {
  const el = document.getElementById('login');
  const callback = () => (el.style.color = 'blue');

  if (el) {
    el.addEventListener('click', () => {
      const loggedIn = getLoginState();
      const admin = loggedIn?.roles?.includes(SUPER_ADMIN);
      const impersonating = context?.provider;

      const items = [
        {
          text: 'Log in',
          hide: loggedIn,
          onClick: () => loginModal(callback),
        },
        {
          style: 'text-decoration: line-through;',
          onClick: cancelImpersonation,
          text: 'Impersonate',
          hide: !admin || !impersonating,
        },
        {
          onClick: impersonate,
          text: 'Impersonate',
          hide: !admin || impersonating,
        },
        {
          text: 'Log out',
          hide: !loggedIn,
          onClick: logOut,
        },
      ];
      tipster({ target: el, title: 'Authorization', items });
    });
  }
}
