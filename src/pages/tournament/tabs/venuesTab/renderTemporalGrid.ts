/**
 * Render and manage the temporal grid for court availability visualization.
 * Creates a TemporalGrid from the tournament record and provides save logic
 * that maps engine state back to dateAvailability per court.
 */
import { createTemporalGrid, TemporalGrid, type TemporalGridLabels } from 'courthive-components';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { t } from 'i18n';

// constants
import { MODIFY_COURT_AVAILABILITY, MODIFY_VENUE } from 'constants/mutationConstants';

export type TemporalGridInstance = {
  grid: TemporalGrid;
  save: () => void;
  destroy: () => void;
};

export interface RenderTemporalGridOptions {
  labels?: TemporalGridLabels;
  language?: string;
  onSetDefaultAvailability?: () => void;
  onSave?: () => void;
}

export function renderTemporalGrid(
  container: HTMLElement,
  options?: RenderTemporalGridOptions,
): TemporalGridInstance {
  const { tournamentRecord } = tournamentEngine.getTournament();

  const grid = createTemporalGrid(
    {
      tournamentRecord,
      showToolbar: true,
      showVenueTree: true,
      showCapacity: true,
      labels: options?.labels,
      language: options?.language,
      onSetDefaultAvailability: options?.onSetDefaultAvailability,
      onSave: options?.onSave,
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
  const methods: { method: string; params: any }[] = [];

  for (const venue of venues) {
    // 1. Venue defaults — emit modifyVenue if changed
    const venueAvail = engine.getVenueAvailability(tournamentRecord.tournamentId, venue.venueId);
    if (venueAvail) {
      const changed =
        venueAvail.startTime !== venue.defaultStartTime || venueAvail.endTime !== venue.defaultEndTime;
      if (changed) {
        methods.push({
          method: MODIFY_VENUE,
          params: {
            venueId: venue.venueId,
            modifications: {
              defaultStartTime: venueAvail.startTime,
              defaultEndTime: venueAvail.endTime,
            },
          },
        });
      }
    }

    // 2. Per-court — only emit modifyCourtAvailability for courts with overrides or blocks
    for (const court of venue.courts ?? []) {
      const courtRef = {
        tournamentId: tournamentRecord.tournamentId,
        venueId: venue.venueId,
        courtId: court.courtId,
      };

      const courtKeys = engine.getCourtAvailabilityKeys(courtRef);
      const hasOverrides = courtKeys.length > 0;

      // Collect blocks for this court across all days
      const dateAvailability: any[] = [];
      let hasBlocks = false;

      for (const day of tournamentDays) {
        const dayBlocks = engine
          .getDayBlocks(day)
          .filter((block: any) => block.court.courtId === court.courtId && block.court.venueId === venue.venueId);

        if (dayBlocks.length) hasBlocks = true;

        // Only include days where this court has overrides or blocks
        const dayHasOverride = courtKeys.includes(day) || courtKeys.includes('DEFAULT');
        if (!dayHasOverride && !dayBlocks.length) continue;

        const avail = engine.getCourtAvailability(courtRef, day);
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

      const hadPrevious = (court.dateAvailability?.length ?? 0) > 0;

      if (!hasOverrides && !hasBlocks) {
        // No court-level state — clear stale data if it existed
        if (hadPrevious) {
          methods.push({
            method: MODIFY_COURT_AVAILABILITY,
            params: { courtId: court.courtId, dateAvailability: [] },
          });
        }
        // else: nothing to save, skip
      } else if (dateAvailability.length) {
        methods.push({
          method: MODIFY_COURT_AVAILABILITY,
          params: { courtId: court.courtId, dateAvailability },
        });
      }
    }
  }

  if (!methods.length) return;

  mutationRequest({
    methods,
    callback: (result: any) => {
      if (result?.success) {
        tmxToast({ message: t('success'), intent: 'is-success' });
        grid.resetDirtyState();
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
