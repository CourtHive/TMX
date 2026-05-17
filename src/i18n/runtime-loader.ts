/**
 * Runtime i18n loader — fetches locale files from CFS on demand and caches
 * them in localStorage keyed by SHA version.
 *
 * Phase 5 of the i18n delivery migration (see Mentat/planning/I18N_DELIVERY.md).
 *
 * Coexistence with the bundled locales:
 *   - i18n.ts still statically imports the bundled locales at build time,
 *     so cold-start renders instantly with no network round-trip.
 *   - On boot, runtime-loader checks the CFS manifest in the background.
 *     If a newer SHA is available for the current locale, fetch it and
 *     swap into i18next via addResourceBundle.
 *   - In a later phase, the bundled non-English imports will be removed
 *     and runtime-loader becomes the only source for those locales; English
 *     stays bundled as the cold-start fallback.
 *
 * Public API:
 *   - fetchManifest()        → manifest from CFS
 *   - getCachedLocale(code)  → locally-cached JSON, if any
 *   - ensureLocaleCurrent(code) → if manifest's SHA newer than cache,
 *                                  fetch + cache + addResourceBundle
 */
import { baseApi } from 'services/apis/baseApi';
import i18next from 'i18next';

export interface LocaleManifestEntry {
  code: string;
  label: string;
  nativeLabel: string;
  version: string; // SHA-256 of the file content (immutable cache key)
  size: number;
  keyCount: number;
  completeness: number; // 0..1
  rtl: boolean;
}

export interface Manifest {
  version: string; // courthive-i18n package version (informational)
  generatedAt: string;
  locales: LocaleManifestEntry[];
}

interface CachedLocale {
  version: string;
  content: Record<string, unknown>;
}

const LOCALE_KEY = (code: string) => `tmx.i18n.locale.${code}`;
const VERSION_KEY = (code: string) => `tmx.i18n.version.${code}`;
const MANIFEST_CACHE_KEY = 'tmx.i18n.manifest';
const MANIFEST_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Read the cached manifest from localStorage if still fresh. */
function getCachedManifest(): { manifest: Manifest; cachedAt: number } | null {
  try {
    const raw = localStorage.getItem(MANIFEST_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.cachedAt !== 'number' || !parsed?.manifest) return null;
    return { manifest: parsed.manifest, cachedAt: parsed.cachedAt };
  } catch {
    return null;
  }
}

function writeCachedManifest(manifest: Manifest): void {
  try {
    localStorage.setItem(MANIFEST_CACHE_KEY, JSON.stringify({ manifest, cachedAt: Date.now() }));
  } catch {
    // Storage quota or disabled — ignore; manifest will be re-fetched next call.
  }
}

/**
 * Fetch the manifest from CFS. Caches in localStorage for MANIFEST_CACHE_TTL_MS.
 * Pass { force: true } to bypass the freshness check.
 */
export async function fetchManifest(opts: { force?: boolean } = {}): Promise<Manifest | null> {
  if (!opts.force) {
    const cached = getCachedManifest();
    if (cached && Date.now() - cached.cachedAt < MANIFEST_CACHE_TTL_MS) {
      return cached.manifest;
    }
  }

  try {
    const response = await baseApi.get('/i18n/manifest', { silenceErrors: true } as any);
    const manifest = response?.data as Manifest;
    if (!manifest?.locales) return null;
    writeCachedManifest(manifest);
    return manifest;
  } catch {
    // Network failure — fall back to last cache even if stale.
    return getCachedManifest()?.manifest ?? null;
  }
}

/** Read a locally-cached locale file by code. */
export function getCachedLocale(code: string): CachedLocale | null {
  try {
    const version = localStorage.getItem(VERSION_KEY(code));
    const raw = localStorage.getItem(LOCALE_KEY(code));
    if (!version || !raw) return null;
    return { version, content: JSON.parse(raw) };
  } catch {
    return null;
  }
}

function writeCachedLocale(code: string, version: string, content: Record<string, unknown>): void {
  try {
    localStorage.setItem(LOCALE_KEY(code), JSON.stringify(content));
    localStorage.setItem(VERSION_KEY(code), version);
  } catch {
    // Storage quota — drop silently. Next call will re-fetch.
  }
}

/**
 * Fetch a locale's JSON from CFS, honoring ETag/304 against the local cache.
 * Returns the locale content + its SHA version, or null if the fetch fails
 * and no cache exists.
 */
export async function fetchLocale(code: string): Promise<CachedLocale | null> {
  const cached = getCachedLocale(code);
  const headers: Record<string, string> = {};
  if (cached?.version) headers['If-None-Match'] = cached.version;

  try {
    const response = await baseApi.get(`/i18n/locales/${code}`, {
      headers,
      silenceErrors: true,
      validateStatus: (status: number) => status === 200 || status === 304,
    } as any);

    if (response?.status === 304 && cached) return cached;

    const etag = response?.headers?.etag ?? response?.headers?.ETag;
    if (!etag || !response?.data) return cached;

    const content = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    writeCachedLocale(code, etag, content);
    return { version: etag, content };
  } catch {
    return cached;
  }
}

/**
 * Ensure the in-memory i18next bundle for `code` is current with respect to
 * the latest manifest from CFS. Whether the locale comes from a fresh CFS
 * fetch or a localStorage cache, the bundle is always loaded into i18next
 * if it isn't already there — without this, a second page load with a
 * cached locale would render English fallbacks because i18next.init() in
 * i18n.ts only seeds `en`, and the cache-version-match path here used to
 * early-return before calling addResourceBundle.
 *
 * Safe to call multiple times; safe to call when CFS is unreachable (falls
 * back to whatever's in cache).
 */
export async function ensureLocaleCurrent(code: string): Promise<void> {
  // Helper: load content into i18next only when not already loaded, so we
  // don't churn over the bundle on every call.
  const ensureBundle = (content: Record<string, unknown>) => {
    if (i18next.hasResourceBundle(code, 'translation')) return;
    i18next.addResourceBundle(code, 'translation', content, true, true);
  };

  const manifest = await fetchManifest();
  const cached = getCachedLocale(code);

  // No manifest reachable — fall back to whatever's cached so a returning
  // user still sees their language even when CFS is offline.
  if (!manifest) {
    if (cached) ensureBundle(cached.content);
    return;
  }

  const entry = manifest.locales.find((l) => l.code === code);
  if (!entry) {
    // Manifest doesn't list this code, but a stale cache might still cover
    // the user's previous selection. Better to show stale content than
    // English fallback for keys that don't exist in en.
    if (cached) ensureBundle(cached.content);
    return;
  }

  // Cache matches manifest — load into i18next and skip the network.
  if (cached && cached.version === entry.version) {
    ensureBundle(cached.content);
    return;
  }

  // Cache is stale or missing — fetch + cache + load.
  const fetched = await fetchLocale(code);
  if (!fetched) {
    if (cached) ensureBundle(cached.content);
    return;
  }
  ensureBundle(fetched.content);
}

/** Available locale codes per the latest manifest. Used by selectIdiom. */
export async function getAvailableLocales(): Promise<LocaleManifestEntry[]> {
  const manifest = await fetchManifest();
  return manifest?.locales ?? [];
}
