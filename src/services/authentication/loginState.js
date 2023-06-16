import { cleanup, validateToken } from 'services/authentication/actions';
import { getJwtTokenStorageKey } from 'config/localStorage';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { context } from 'services/context';

const JWT_TOKEN_STORAGE_NAME = getJwtTokenStorageKey();

export function getLoginState() {
  const token = localStorage.getItem(JWT_TOKEN_STORAGE_NAME);
  return validateToken(token);
}
export function logOut() {
  localStorage.removeItem(JWT_TOKEN_STORAGE_NAME);
  cleanup(true);
}

export function logIn({ data }) {
  const decodedToken = validateToken(data.token);
  if (decodedToken) {
    localStorage.setItem(JWT_TOKEN_STORAGE_NAME, data.token);
    tmxToast({ intent: 'is-success', message: 'Login successful' });
    tournamentEngine.reset();
    context.router.navigate('/');
  }
}
