import { serverConfig } from 'config/serverConfig';
import { platform } from 'platform';

/**
 * The origin TMX's sibling services (declarations, AMS) sit behind.
 *
 * On the web that is where TMX itself is served from, which nginx fronts for every service. On desktop
 * it is not: the page is `app://tmx`, which is no network host, so a path built from `location.origin`
 * resolved to `app://tmx/ams/...` and every call failed. There the configured server is the origin —
 * the same one REST (`baseApi`) and the socket already use.
 */
export function serviceOrigin(): string {
  if (platform.isDesktop()) {
    const server = serverConfig.get().socketPath || platform.getDefaultServerUrl();
    try {
      return new URL(server).origin;
    } catch {
      return '';
    }
  }
  return globalThis.location?.origin ?? '';
}

/**
 * A sibling service's base URL: its own port when the origin is a local development host, otherwise
 * `<origin><path>` behind the reverse proxy.
 */
export function siblingServiceBaseUrl(devPort: number, path: string): string {
  const origin = serviceOrigin();
  let hostname = '';
  try {
    hostname = new URL(origin).hostname;
  } catch {
    // No resolvable origin: fall through to the proxied path, as before.
  }
  const local = hostname === 'localhost' || hostname === '127.0.0.1';
  return local ? `http://localhost:${devPort}` : `${origin}${path}`;
}
