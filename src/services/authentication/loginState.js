import { getToken, removeToken, setToken } from './tokenManagement';
import { validateToken } from 'services/authentication/validateToken';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { checkDevState } from './checkDevState';
import { context } from 'services/context';

export function getLoginState() {
  const token = getToken();
  return validateToken(token);
}

export function logOut() {
  removeToken();
  checkDevState();
  context.router.navigate('/');
}

export function logIn({ data }) {
  const decodedToken = validateToken(data.token);
  if (decodedToken) {
    setToken(data.token);
    tmxToast({ intent: 'is-success', message: 'Login successful' });
    tournamentEngine.reset();
    context.router.navigate('/');
  }
}
