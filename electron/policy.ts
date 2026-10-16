/**
 * Electron security policy — pure decisions, no `electron` import, so they are unit-tested
 * (`policy.test.ts`) without launching the app.
 *
 * The renderer is untrusted: it renders server-delivered strings with innerHTML, so script in the
 * page is assumed reachable. Everything the page asks the main process for passes through here.
 * See Mentat/planning/TMX_ELECTRON_SECURITY.md.
 */
import { basename } from 'path';

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

/** True when `path` ends in one of the filters' extensions. */
export function hasAllowedExtension(path: string, filters: FileFilter[]): boolean {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return filters.some((filter) => filter.extensions.includes(ext));
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

/**
 * Whether `url` is the app itself: the same file (ignoring hash and query) for the packaged
 * renderer, or the same origin for the development server.
 */
export function isAppUrl(url: string, appUrl: string): boolean {
  let target: URL;
  let app: URL;
  try {
    target = new URL(url);
    app = new URL(appUrl);
  } catch {
    return false;
  }
  if (app.protocol === 'file:') return target.protocol === 'file:' && target.pathname === app.pathname;
  return target.origin === app.origin;
}

/** A blob: URL minted by the app's own origin (the PDF preview), e.g. `blob:file:///<uuid>`. */
export function isAppBlobUrl(url: string, appUrl: string): boolean {
  if (!url.startsWith('blob:')) return false;
  try {
    const inner = new URL(url.slice('blob:'.length));
    const app = new URL(appUrl);
    return app.protocol === 'file:' ? inner.protocol === 'file:' : inner.origin === app.origin;
  } catch {
    return false;
  }
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
