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
 * NOTE: which cells are actually reserved (vs the viewer's own, which render normally) ultimately
 * depends on the server's per-tournament `access` flag (view vs author) — the CFS coordination-view
 * work. Until that lands, the projection only returns tournaments the viewer can already see, so this
 * surfaces nothing in production; it is exercised via a stubbed projection in e2e.
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

  const peerIds = peerLinkedIds(primaryRecord);
  if (!peerIds.length) {
    cache = { tournamentId: primaryId, cells: [] };
    return 0;
  }

  try {
    const result: any = await fetchScheduleProjection({
      tournamentIds: peerIds,
      venueIds: primaryVenueIds(primaryRecord),
      silent: true,
    });
    // A projection cell for another tournament = a reserved slot from the viewer's perspective.
    const cells = (result?.data?.scheduleCells ?? []).filter((cell: any) => cell?.tournamentId !== primaryId);
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
