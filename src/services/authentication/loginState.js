import { validateToken } from 'services/authentication/validateToken';
import { getToken, removeToken, setToken } from './tokenManagement';
import { disconnectSocket } from 'services/messaging/socketIo';
import { tournamentEngine } from 'tods-competition-factory';
import { loginModal } from 'components/modals/loginModal';
import { tmxToast } from 'services/notifications/tmxToast';
import { checkDevState } from './checkDevState';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

import { TMX_TOURNAMENTS } from 'constants/tmxConstants';

export function getLoginState() {
  const token = getToken();
  const el = document.getElementById('login');
  const valid = validateToken(token);
  if (valid) el.style.color = 'blue';
  return valid;
}

export function logOut() {
  removeToken();
  checkDevState();
  disconnectSocket();
  context.provider = undefined; // clear provider
  context.router.navigate(`/${TMX_TOURNAMENTS}`);
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

export function initLoginToggle() {
  const el = document.getElementById('login');
  const callback = () => (el.style.color = 'blue');
  if (el) {
    el.addEventListener('click', () => {
      const loggedIn = getLoginState();
      if (!loggedIn) {
        loginModal(callback);
      } else {
        logOut();
        el.style.color = '';
      }
    });
  }
}
