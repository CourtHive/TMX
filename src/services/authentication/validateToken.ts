import { getRefreshToken, removeToken } from './tokenManagement';
import { setDev } from 'services/setDev';
import { jwtDecode } from 'jwt-decode';
import { attemptSilentRefresh, logOut } from './loginState';

import type { LoginState } from 'types/tmx';

export function validateToken(token: string | null | undefined): LoginState | undefined {
  if (!token || token === 'undefined') {
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
    // An expired access token no longer means "log out" — if a refresh token
    // is present, silently exchange it for a new access token and re-apply the
    // session (fire-and-forget; re-renders on success, logs out on failure).
    // Returning undefined here just means "not valid yet this tick".
    if (getRefreshToken()) {
      void attemptSilentRefresh();
      return undefined;
    }
    logOut();
    return undefined;
  }

  if (decodedToken.permissions?.includes('devMode') || decodedToken.roles?.includes('develope')) setDev();

  return decodedToken;
}
