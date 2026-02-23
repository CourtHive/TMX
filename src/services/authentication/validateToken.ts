import { checkDevState } from './checkDevState';
import { removeToken } from './tokenManagement';
import { setDev } from 'services/setDev';
import { jwtDecode } from 'jwt-decode';
import { logOut } from './loginState';

import type { LoginState } from 'types/tmx';

export function validateToken(token: string | null | undefined): LoginState | undefined {
  if (!token || token === 'undefined') {
    checkDevState();
    return undefined;
  }

  let decodedToken: LoginState;

  try {
    decodedToken = jwtDecode<LoginState>(token);
  } catch {
    // Token decode failed - invalid token, remove it
    removeToken();
    return undefined;
  }

  const dateNow = new Date();
  const tokenExpired = decodedToken.exp < dateNow.getTime() / 1000;
  if (tokenExpired) {
    logOut();
    return undefined;
  }

  if (decodedToken.permissions?.includes('devMode') || decodedToken.roles?.includes('develope')) setDev();

  return decodedToken;
}
