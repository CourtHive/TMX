/**
 * Official-registry reads, proxied by courthive-ams.
 *
 * The `OfficialRecord` — certifications, suspensions, evaluations — lives in **courthive-ams**, not
 * in the tournament record. CFS's `official_records` table is a dead husk with no module behind it,
 * and the registry never becomes a second home for this data (a stated non-goal of the officials
 * plan). TMX reads; AMS owns.
 *
 * Same auth as `facilitiesApi`: the admin JWT TMX already holds, which AMS verifies and dual-accepts
 * against CFS's ES256. No new signing path, and the base URL resolution is shared rather than
 * re-derived.
 *
 * **Every read here fails SOFT and says so.** Most tournaments have no AMS registry configured at
 * all, and that is a legitimate configuration rather than a degraded one — officials are simply
 * INDIVIDUAL participants with the OFFICIAL role. So a missing registry must render as
 * *"not checked"*, never as a green tick. `fetchOfficialRecords` returns `undefined` for
 * "could not ask" and a (possibly empty) map for "asked and this is the answer" — the two are
 * different facts and the caller must be able to tell them apart.
 */

import { getAmsBaseUrl } from './facilitiesApi';
import { getJwtTokenStorageKey } from 'config/localStorage';

/** As held by AMS. Passed to the factory untranslated — it owns the eligibility rules. */
export interface OfficialRecord {
  officialRecordId?: string;
  personId?: string;
  participantId?: string;
  certifications?: any[];
  suspensions?: any[];
  [attr: string]: unknown;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(getJwtTokenStorageKey());
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * Official records for a set of people, keyed by the id they were requested under.
 *
 * Returns `undefined` when the registry could not be reached or is not configured — **the
 * "not checkable" signal**, distinct from an empty map, which means the registry answered and holds
 * no record for anybody asked. A caller that collapses those two produces exactly the green tick the
 * fail-soft rule exists to prevent.
 *
 * Never throws: a picker must open whether or not AMS is up.
 */
export async function fetchOfficialRecords(
  personIds: string[],
  signal?: AbortSignal,
): Promise<Record<string, OfficialRecord> | undefined> {
  const ids = personIds.filter(Boolean);
  if (!ids.length) return {};

  try {
    const params = new URLSearchParams({ personIds: ids.join(',') });
    const res = await fetch(`${getAmsBaseUrl()}/officiating/records?${params.toString()}`, {
      headers: authHeaders(),
      signal,
    });
    if (!res.ok) return undefined;

    const body = await res.json();
    const records: OfficialRecord[] = Array.isArray(body) ? body : (body?.records ?? []);
    if (!Array.isArray(records)) return undefined;

    const byId: Record<string, OfficialRecord> = {};
    for (const record of records) {
      const key = record?.personId ?? record?.participantId;
      if (key) byId[String(key)] = record;
    }
    return byId;
  } catch {
    // Includes an aborted request. "Could not ask" is the honest answer in every one of these cases.
    return undefined;
  }
}
