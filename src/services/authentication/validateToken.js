import { checkDevState } from './checkDevState';
import { removeToken } from './tokenManagement';
import { setDev } from 'services/setDev';
import { jwtDecode } from 'jwt-decode';
import { logOut } from './loginState';

export function validateToken(token) {
  if (!token || token === 'undefined') {
    checkDevState();
    return undefined;
  }

  let decodedToken;

  try {
    decodedToken = jwtDecode(token);
  } catch (err) {
    removeToken();
    return;
  }

  const dateNow = new Date();
  const tokenExpired = decodedToken?.exp < dateNow.getTime() / 1000;
  if (tokenExpired) return logOut();

  if (decodedToken?.permissions?.includes('devMode') || decodedToken?.roles?.includes('develope')) setDev();

  return decodedToken;
}
