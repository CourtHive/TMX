import { context } from 'services/context';
import { setDev } from 'services/setDev';
import { jwtDecode } from 'jwt-decode';

export function validateToken(token) {
  if (!token || token === 'undefined') {
    cleanup();
    return undefined;
  }

  const decodedToken = jwtDecode(token);
  const dateNow = new Date();

  const tokenExpired = decodedToken?.exp < dateNow.getTime() / 1000;
  if (tokenExpired) {
    cleanup();
    return undefined;
  }

  if (decodedToken?.profile?.permissions?.includes('devMode')) setDev();

  return decodedToken;
}

export function cleanup(reset) {
  const notLocal = !window.location.host.startsWith('localhost');
  if (notLocal) delete window.dev;
  if (reset) {
    if (notLocal) console.log('%c dev cancelled', 'color: cyan');
    context.router.navigate('/');
  }
}
