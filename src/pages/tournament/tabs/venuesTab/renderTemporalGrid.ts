/**
 * Render and manage the temporal grid for court availability visualization.
 * Creates a TemporalGrid from the tournament record and provides save logic
 * that maps engine state back to dateAvailability per court.
 */
import { createTemporalGrid, TemporalGrid } from 'courthive-components';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { t } from 'i18n';

// constants
import { MODIFY_COURT_AVAILABILITY } from 'constants/mutationConstants';

export type TemporalGridInstance = {
  grid: TemporalGrid;
  save: () => void;
  destroy: () => void;
};

export function renderTemporalGrid(container: HTMLElement): TemporalGridInstance {
  const { tournamentRecord } = tournamentEngine.getTournament();

  const grid = createTemporalGrid(
    {
      tournamentRecord,
      showToolbar: true,
      showVenueTree: true,
      showCapacity: true,
    },
    container,
  );

  return {
    grid,
    save: () => saveGridState(grid),
    destroy: () => grid.destroy(),
  };
}

function saveGridState(grid: TemporalGrid): void {
  const engine = grid.getEngine();
  const { tournamentRecord } = tournamentEngine.getTournament();
  if (!tournamentRecord) return;

  const tournamentDays = engine.getTournamentDays();
  const venues = tournamentRecord.venues ?? [];

  const courtAvailabilityMap: Record<string, any[]> = {};

  for (const venue of venues) {
    for (const court of venue.courts ?? []) {
      const courtRef = {
        tournamentId: tournamentRecord.tournamentId,
        venueId: venue.venueId,
        courtId: court.courtId,
      };

      const dateAvailability: any[] = [];

      for (const day of tournamentDays) {
        const avail = engine.getCourtAvailability(courtRef, day);
        if (!avail) continue;

        const dayBlocks = engine
          .getDayBlocks(day)
          .filter((block: any) => block.court.courtId === court.courtId && block.court.venueId === venue.venueId);

        const bookings = dayBlocks.map((block: any) => ({
          startTime: extractTime(block.start),
          endTime: extractTime(block.end),
          bookingType: block.type,
        }));

        const entry: any = {
          date: day,
          startTime: avail.startTime,
          endTime: avail.endTime,
        };
        if (bookings.length) entry.bookings = bookings;

        dateAvailability.push(entry);
      }

      if (dateAvailability.length) {
        courtAvailabilityMap[court.courtId] = dateAvailability;
      }
    }
  }

  const methods = Object.entries(courtAvailabilityMap).map(([courtId, dateAvailability]) => ({
    method: MODIFY_COURT_AVAILABILITY,
    params: { courtId, dateAvailability },
  }));

  if (!methods.length) return;

  mutationRequest({
    methods,
    callback: (result: any) => {
      if (result?.success) {
        tmxToast({ message: t('success'), intent: 'is-success' });
      }
    },
  });
}

function extractTime(isoOrTime: string): string {
  if (isoOrTime.includes('T')) {
    return isoOrTime.split('T')[1].substring(0, 5);
  }
  return isoOrTime.substring(0, 5);
}
