/**
 * Local (IndexedDB) mirror of the server's provider-calendar side-effect.
 *
 * The tournaments list is meant to render from lightweight calendar entries, not
 * by loading every full tournament record. Connected mode already does this via
 * `getMyCalendars`; this module gives local/offline mode the same optimization:
 * every local save maintains the provider's `calendar` entry, and the list reads
 * those entries instead of `findAllTournaments()` (a full-record load of all).
 *
 * The entry shape is derived by the factory (`getTournamentCalendarEntry`) so the
 * local entry is byte-identical to the one the server persists — no drift.
 */
import { tournamentEngine } from 'services/factory/engine';
import { tmx2db } from './tmx2db';

// Bucket for tournaments with no provider (demo / scratchpad) so they still get a
// lightweight list entry without a separate store.
const LOCAL_BUCKET = '__local__';
const MIGRATED_KEY = 'tmx_local_calendar_migrated';

function providerBucket(tournamentRecord: any): string {
  return tournamentRecord?.parentOrganisation?.organisationId || LOCAL_BUCKET;
}

/**
 * Derive and persist the lightweight calendar entry for one record into the
 * local provider calendar (upsert). The local mirror of the server's
 * `addToOrUpdateCalendar`. Best-effort — a failure here must never break a save.
 */
export async function maintainLocalCalendarEntry(tournamentRecord: any): Promise<void> {
  if (!tournamentRecord?.tournamentId) return;
  try {
    const entry = tournamentEngine.getTournamentCalendarEntry({ tournamentRecord });
    if (entry?.tournamentId) await tmx2db.upsertCalendarEntry(providerBucket(tournamentRecord), entry);
  } catch (err) {
    console.error('[localCalendar] failed to maintain entry', err);
  }
}

/**
 * One-time: build local calendars from the full records already in IndexedDB so
 * the list can read entries without ever full-loading again. Idempotent via a
 * localStorage flag; the flag is cleared automatically when IDB is wiped on a
 * major schema change (see tmx2db).
 */
async function ensureLocalCalendarMigrated(): Promise<void> {
  if (typeof localStorage !== 'undefined' && localStorage.getItem(MIGRATED_KEY) === '1') return;
  const tournaments = await tmx2db.findAllTournaments();
  for (const tournamentRecord of tournaments) await maintainLocalCalendarEntry(tournamentRecord);
  if (typeof localStorage !== 'undefined') localStorage.setItem(MIGRATED_KEY, '1');
}

/**
 * Wipe the maintained local calendars and clear the migration flag. Called on the
 * same logout/login transitions as `deleteProviderBoundTournaments` so provider
 * calendar entries never leak across users; the next list read re-derives the
 * surviving (demo) tournaments' entries.
 */
export async function resetLocalCalendar(): Promise<void> {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(MIGRATED_KEY);
  try {
    await tmx2db.clearAllProviderCalendars();
  } catch (err) {
    console.error('[localCalendar] reset failed', err);
  }
}

/**
 * All maintained local calendar entries (lightweight) — the list read source in
 * local/offline mode, replacing a full-record load of every tournament.
 */
export async function readLocalCalendarEntries(): Promise<any[]> {
  await ensureLocalCalendarMigrated();
  const providers = await tmx2db.findAllProviders();
  return providers.flatMap((provider: any) => (Array.isArray(provider?.calendar) ? provider.calendar : []));
}
