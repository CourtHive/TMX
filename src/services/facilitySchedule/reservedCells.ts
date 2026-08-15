import { peerLinkedIds, primaryVenueIds } from './facilityScheduleHelpers';
import { fetchScheduleProjection } from 'services/apis/servicesApi';

/**
 * Shared-facility reserved cells.
 *
 * A court slot taken by another facility-sharing tournament is shown in the grid as a read-only
 * "reserved" cell (see courthive-components `isReserved`). The data is a slim `ScheduleCell[]` from
 * the schedule projection — NOT loaded tournamentRecords. This module fetches and caches those cells
 * for the loaded tournament; `gridView` reads them per-date and injects them into empty grid slots.
 *
 * The request is the coordination view: it sends the loaded (authored) tournament as the context, and
 * the server returns projections of its server-verified linked peers tagged `access:'author'|'view'`.
 * **Both** become reserved cells, for different reasons:
 *
 * - `view` — a different director/provider sharing the facility. Opaque: the cell shows that a court
 *   is taken, never by whom (the server strips detail via `opaqueReservedCell`).
 * - `author` — one of the viewer's OWN linked tournaments. Carries `tournamentName` so the director
 *   can see which of their tournaments holds the court.
 *
 * `author` peers were previously filtered out here, on the assumption that they "render normally".
 * They do not. Nothing loads peer tournamentRecords into the engine on the scheduling tab
 * (`competitionEngine`/`tournamentEngine` are the same factory singletons over one state store, and
 * TMX seeds a single record), so an author peer's matchUps were neither drawn nor reserved and the
 * slot rendered EMPTY — a court shown free while the director's own linked tournament played on it.
 * Until same-provider peers are loaded into the engine for a fully interactive integrated grid,
 * reserved-and-named is the truthful representation.
 */

let cache: { tournamentId: string; cells: any[] } | null = null;

/**
 * Fetch the reserved cells (other-tournament court occupancy) for the primary's linked facility
 * peers and cache them. Best-effort: a failed/absent projection caches an empty set rather than
 * throwing. Returns the number of reserved cells loaded.
 */
export async function loadReservedCells(primaryRecord: any): Promise<number> {
  const primaryId = primaryRecord?.tournamentId;
  if (!primaryId) return 0;

  // No linked peers → nothing to coordinate around; skip the server round-trip.
  if (!peerLinkedIds(primaryRecord).length) {
    cache = { tournamentId: primaryId, cells: [] };
    return 0;
  }

  try {
    const result: any = await fetchScheduleProjection({
      tournamentId: primaryId, // coordination context — the server expands to this tournament's links
      venueIds: primaryVenueIds(primaryRecord),
      silent: true,
    });
    // Both `view` and `author` peers occupy courts the viewer must not double-book. Cells with no
    // access tag are treated as reserved too — a projection shape we don't recognise must not
    // silently become an empty court.
    const cells = result?.data?.scheduleCells ?? [];
    cache = { tournamentId: primaryId, cells };
    return cells.length;
  } catch {
    cache = { tournamentId: primaryId, cells: [] };
    return 0;
  }
}

/**
 * Re-fetch reserved cells and report whether they changed since the cached set. Used by the grid's
 * lightweight live refresh — a peer director's reschedule is NOT broadcast to this client (the peer
 * isn't loaded), so we poll/refresh-on-focus and only re-render the grid when something actually
 * moved.
 */
export async function reloadReservedCells(primaryRecord: any): Promise<boolean> {
  const before = JSON.stringify(cache?.cells ?? []);
  await loadReservedCells(primaryRecord);
  return JSON.stringify(cache?.cells ?? []) !== before;
}

/** Reserved cells for a given date, scoped to the loaded tournament. Empty when none are cached. */
export function getReservedCellsForDate(scheduledDate: string, primaryId: string): any[] {
  if (!cache || cache.tournamentId !== primaryId) return [];
  return cache.cells.filter((cell) => cell?.scheduledDate === scheduledDate);
}

/** True when reserved cells are cached for this tournament (drives the load-once guard). */
export function hasReservedCells(primaryId: string): boolean {
  return cache?.tournamentId === primaryId;
}

/** Drop the cache — called on scheduling teardown / tournament switch. */
export function clearReservedCells(): void {
  cache = null;
}
