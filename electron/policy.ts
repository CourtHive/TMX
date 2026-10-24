/**
 * Electron security policy — pure decisions, no `electron` import, so they are unit-tested
 * (`policy.test.ts`) without launching the app.
 *
 * The renderer is untrusted: it renders server-delivered strings with innerHTML, so script in the
 * page is assumed reachable. Everything the page asks the main process for passes through here.
 * See Mentat/planning/TMX_ELECTRON_SECURITY.md.
 */
import { basename, resolve, sep } from 'path';

export interface FileFilter {
  name: string;
  extensions: string[];
}

/** What TMX saves: tournament/report JSON and CSV reports. */
export const SAVE_EXTENSIONS: readonly string[] = ['json', 'csv', 'txt'];
/** What TMX opens: CODES tournament JSON. */
export const OPEN_EXTENSIONS: readonly string[] = ['json'];
/** Per-file cap on both directions; the largest real tournament records are a few MB. */
export const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_NAME_LENGTH = 200;

/** The renderer is served from `app://tmx/`, never `file://` (see `resolveAppFile`). */
export const APP_SCHEME = 'app';
export const APP_HOST = 'tmx';
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

/** Permissions TMX uses: desktop notifications, clipboard writes (call sheet), fullscreen. */
export const ALLOWED_PERMISSIONS: ReadonlySet<string> = new Set([
  'notifications',
  'clipboard-sanitized-write',
  'fullscreen',
]);

/** Filters the page asked for, kept only if every extension is allowed; undefined refuses. */
export function allowedFilters(filters: unknown, allowed: readonly string[]): FileFilter[] | undefined {
  if (!Array.isArray(filters) || filters.length === 0 || filters.length > 5) return undefined;
  const result: FileFilter[] = [];
  for (const filter of filters) {
    const name = typeof filter?.name === 'string' ? filter.name.slice(0, 60) : '';
    const extensions = filter?.extensions;
    if (!Array.isArray(extensions) || extensions.length === 0) return undefined;
    const normalized = extensions.map((ext: unknown) => (typeof ext === 'string' ? ext.toLowerCase() : ''));
    if (!normalized.every((ext) => allowed.includes(ext))) return undefined;
    result.push({ name, extensions: normalized });
  }
  return result;
}

/** A bare file name to pre-fill the save dialog: no directory, no control characters. */
export function safeDefaultName(name: unknown): string | undefined {
  if (typeof name !== 'string') return undefined;
  // eslint-disable-next-line no-control-regex
  const bare = basename(name.replaceAll('\\', '/')).replace(/[\u0000-\u001f\u007f]/g, '');
  if (!bare || bare === '.' || bare === '..') return undefined;
  return bare.slice(0, MAX_NAME_LENGTH);
}

const extensionOf = (name: string) => (name.includes('.') ? (name.split('.').pop() ?? '').toLowerCase() : '');

/** True when `path` ends in one of the filters' extensions. */
export function hasAllowedExtension(path: string, filters: FileFilter[]): boolean {
  const ext = extensionOf(basename(path));
  return filters.some((filter) => filter.extensions.includes(ext));
}

/**
 * `name` if its extension is one the filters allow, otherwise `name` with the first allowed
 * extension appended — so `Update.bat` under a JSON filter is saved as `Update.bat.json`.
 */
export function withAllowedExtension(name: string, filters: FileFilter[]): string {
  return hasAllowedExtension(name, filters) ? name : `${name}.${filters[0].extensions[0]}`;
}

/**
 * The file inside `distDir` that an `app://tmx/…` request names, or undefined for any other host,
 * scheme, or a path that resolves outside `distDir` (including percent-encoded `..`).
 */
export function resolveAppFile(requestUrl: string, distDir: string): string | undefined {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return undefined;
  }
  if (url.protocol !== `${APP_SCHEME}:` || url.host !== APP_HOST) return undefined;
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return undefined;
  }
  if (pathname.includes('\0')) return undefined;
  const root = resolve(distDir);
  const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  return file.startsWith(root + sep) ? file : undefined;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * The server URL the desktop app may persist: https anywhere, http only on this machine.
 * Returns the normalised URL (no trailing slash, no credentials, query or hash), or undefined.
 */
export function normalizeServerUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048) return undefined;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return undefined;
  }
  if (url.username || url.password) return undefined;
  const secure = url.protocol === 'https:';
  const local = url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname);
  if (!secure && !local) return undefined;
  const path = url.pathname.replace(/\/+$/, '');
  return `${url.origin}${path}`;
}

const sameSite = (a: URL, b: URL) => a.protocol === b.protocol && a.host === b.host;

/**
 * Whether `url` is the app itself: same scheme and host as the app (`app://tmx` when packaged or
 * built, the dev server origin in development). Path, query and hash may differ.
 */
export function isAppUrl(url: string, appUrl: string): boolean {
  try {
    return sameSite(new URL(url), new URL(appUrl));
  } catch {
    return false;
  }
}

/** A blob: URL minted by the app's own origin (the PDF preview), e.g. `blob:app://tmx/<uuid>`. */
export function isAppBlobUrl(url: string, appUrl: string): boolean {
  if (!url.startsWith('blob:')) return false;
  return isAppUrl(url.slice('blob:'.length), appUrl);
}

/** An https URL to hand to the system browser; anything else is not opened at all. */
export function externalUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

const TRUSTED_EXTERNAL_DOMAINS = ['courthive.com', 'courthive.net'];

/**
 * Whether an external https link may open without asking: CourtHive's own domains and the
 * configured server's host. Anything else is confirmed by the user first.
 */
export function isTrustedExternal(url: string, serverUrl?: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  if (TRUSTED_EXTERNAL_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))) return true;
  const server = serverUrl ? normalizeServerUrl(serverUrl) : undefined;
  return !!server && new URL(server).hostname === host;
}

/**
 * The `connect-src` the renderer gets as a response header: its own origin, the configured
 * server (https + wss), and local hosts when unpackaged, when no server is set (the renderer then
 * falls back to http://localhost:8383), or when the configured server is itself on loopback.
 *
 * The last case is a local CFS — a developer's, or a sidecar the desktop app runs — whose sibling
 * services (score relay :8384, declarations :3120, AMS :3130) are on other loopback ports. Naming
 * only the server's own origin blocked them. Loopback is this machine, so allowing it widens nothing
 * a remote page could reach.
 */
export function connectSources(serverUrl: string | undefined, packaged: boolean): string {
  const sources = ["'self'"];
  const server = serverUrl ? normalizeServerUrl(serverUrl) : undefined;
  if (server) {
    const { origin, protocol, host } = new URL(server);
    sources.push(origin, `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}`);
  }
  const loopbackServer = !!server && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(server).hostname);
  if (!packaged || !server || loopbackServer) {
    sources.push('http://localhost:*', 'ws://localhost:*', 'http://127.0.0.1:*', 'ws://127.0.0.1:*');
  }
  return `connect-src ${sources.join(' ')}`;
}
