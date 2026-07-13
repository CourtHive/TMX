import { peerLinkedIds, primaryVenueIds } from './facilityScheduleHelpers';
import { fetchScheduleProjection } from 'services/apis/servicesApi';
import { queryGovernor } from 'tods-competition-factory';

/**
 * Assemble the merged shared-facility grid for the loaded primary tournament: the primary's own
 * (operational) schedule projection + slim, read-only projections of its linked peers, merged by the
 * factory's `mergeFacilitySchedule` (which also flags cross-tournament double-bookings). Returns null
 * when the primary has no linked tournaments. Peer fetch failures degrade to primary-only.
 */
export async function assembleFacilityGrid(primaryRecord: any): Promise<{ grid: any; peerIds: string[] } | null> {
  const peerIds = peerLinkedIds(primaryRecord);
  if (!peerIds.length) return null;

  const venueIds = primaryVenueIds(primaryRecord);
  const primaryProjection: any = queryGovernor.getScheduleProjection({ tournamentRecord: primaryRecord, venueIds });
  const primaryCells = primaryProjection?.scheduleCells ?? [];

  let peerCells: any[];
  try {
    const result: any = await fetchScheduleProjection({ tournamentIds: peerIds, venueIds, silent: true });
    peerCells = result?.data?.scheduleCells ?? [];
  } catch {
    peerCells = [];
  }

  const grid: any = queryGovernor.mergeFacilitySchedule({ projections: [primaryCells, peerCells] });
  return { grid, peerIds };
}
