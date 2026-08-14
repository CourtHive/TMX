/**
 * Facility-registry reads for the Venues tab, proxied by courthive-ams.
 *
 * TMX does NOT call `courthive-facilities` directly — the registry is service-token guarded and
 * that token must stay server-side. It also does not go through CFS: a proxied read there would
 * couple scorekeeper acknowledgement latency to an unrelated service, so AMS owns this passthrough
 * (decision 2026-08-11, recorded in courthive-ams `facilities.controller.ts`).
 *
 * Auth is the same admin JWT TMX already holds (`tmxToken`). AMS verifies only and dual-accepts
 * CFS's ES256 tokens, so no new signing path is involved. Search is authenticated but not
 * role-gated (2026-08-13): a facility is one public physical place and the endpoint returns
 * candidates a human chooses, never a resolution verdict.
 *
 * Base URL: `VITE_AMS_URL` (build-time) → localhost-aware fallback (:3130 in dev,
 * `<origin>/ams` in prod) — the same shape `declarationsApi` uses.
 */
import { getJwtTokenStorageKey } from 'config/localStorage';

/** One search hit. `matchedOn` is why the registry surfaced it — shown so a picker is explainable. */
export interface FacilityCandidate {
  facilityId: string;
  name: string;
  city?: string;
  state?: string;
  countryCode?: string;
  courtCount?: number;
  matchedOn?: string;
}

export interface FacilitySearchResult {
  results: FacilityCandidate[];
  nextCursor?: string;
}

/** A TODS `Venue`, shaped by the registry so factory's `addVenue` accepts it untranslated. */
export interface RegistryVenue {
  venueId: string;
  facilityId: string;
  venueName: string;
  courts: Array<{ courtId: string; courtName: string; [attr: string]: unknown }>;
  [attr: string]: unknown;
}

export function getAmsBaseUrl(): string {
  const fromVite = (import.meta as any)?.env?.VITE_AMS_URL;
  if (fromVite) return String(fromVite).replace(/\/+$/, '');
  const loc = globalThis.location;
  const host = loc?.host ?? '';
  const local = host.includes('localhost') || loc?.hostname === '127.0.0.1';
  return local ? 'http://localhost:3130' : `${loc?.origin ?? ''}/ams`;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(getJwtTokenStorageKey());
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * The registry rejects a query shorter than 2 characters with a 400. Returning empty for those
 * locally keeps a picker from firing a request per keystroke that can only fail, and keeps the
 * user's first character from surfacing as a server error.
 */
export const MIN_FACILITY_QUERY = 2;

export async function searchFacilities(
  query: string,
  options: { city?: string; limit?: number; signal?: AbortSignal } = {},
): Promise<FacilitySearchResult> {
  const q = query.trim();
  if (q.length < MIN_FACILITY_QUERY) return { results: [] };

  const params = new URLSearchParams({ q });
  if (options.city) params.set('city', options.city);
  if (options.limit) params.set('limit', String(options.limit));

  const res = await fetch(`${getAmsBaseUrl()}/facilities/search?${params.toString()}`, {
    headers: authHeaders(),
    signal: options.signal,
  });
  if (!res.ok) throw new Error(`facility search failed (${res.status})`);
  return (await res.json()) as FacilitySearchResult;
}

/**
 * The venue payload for a facility the user has already chosen.
 *
 * Returns null for 404 — a facility the registry does not know is a normal outcome the caller
 * reports, not an exception. Any other failure throws, because "the registry is down" and "there
 * is no such facility" must not look the same to the caller.
 */
export async function fetchRegistryVenue(facilityId: string, signal?: AbortSignal): Promise<RegistryVenue | null> {
  const res = await fetch(`${getAmsBaseUrl()}/facilities/${encodeURIComponent(facilityId)}/venue`, {
    headers: authHeaders(),
    signal,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`facility venue fetch failed (${res.status})`);
  return (await res.json()) as RegistryVenue;
}
