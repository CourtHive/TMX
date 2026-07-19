import { peerLinkedIds, primaryVenueIds } from './facilityScheduleHelpers';
import { fetchScheduleProjection } from 'services/apis/servicesApi';

/**
 * Shared-facility reserved cells.
 *
 * A court slot taken by ANOTHER facility-sharing tournament the viewer can't author is shown in the
 * grid as a read-only "reserved" cell (see courthive-components `isReserved`). The data is a slim
 * `ScheduleCell[]` from the schedule projection — NOT loaded tournamentRecords. This module fetches
 * and caches those cells for the loaded tournament; `gridView` reads them per-date and injects them
 * into empty grid slots.
 *
 * The request is the coordination view: it sends the loaded (authored) tournament as the context, and
 * the server returns projections of its server-verified linked peers tagged `access:'author'|'view'`.
 * Only `view` peers (a different director/provider sharing the facility) are reserved cells — an
 * `author` peer is the viewer's own linked tournament and renders normally, not as a reserved slot.
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
    // Only `view` peers are reserved slots; `author` peers are the viewer's own and render normally.
    const cells = (result?.data?.scheduleCells ?? []).filter((cell: any) => cell?.access === 'view');
    cache = { tournamentId: primaryId, cells };
    return cells.length;
  } catch {
    cache = { tournamentId: primaryId, cells: [] };
    return 0;
  }
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
