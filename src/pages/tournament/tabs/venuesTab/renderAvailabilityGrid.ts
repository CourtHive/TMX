/**
 * Render and manage the availability grid for court availability visualization.
 * Creates a AvailabilityGrid from the tournament record and provides save logic
 * that maps engine state back to dateAvailability per court.
 */
import { createAvailabilityGrid, AvailabilityGrid, type AvailabilityGridLabels } from 'courthive-components';
import { openManagePracticeRegistrationsModal } from 'components/modals/managePracticeRegistrationsModal';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import { t } from 'i18n';

// constants
import { MODIFY_COURT_AVAILABILITY, MODIFY_VENUE } from 'constants/mutationConstants';

export type AvailabilityGridInstance = {
  grid: AvailabilityGrid;
  save: () => void;
  destroy: () => void;
};

export interface RenderAvailabilityGridOptions {
  /** ISO yyyy-mm-dd. When supplied, the painter opens with this date focused
   *  instead of defaulting to the tournament's first active day. The workspace
   *  passes the date the operator is currently viewing in Grid/Profile so
   *  switching between modes stays on the same day. */
  initialDay?: string;
  labels?: AvailabilityGridLabels;
  language?: string;
  onSetDefaultAvailability?: () => void;
  onSave?: () => void;
  /**
   * When provided, the painter routes its computed mutation methods through
   * this callback INSTEAD of dispatching directly via `mutationRequest`. The
   * workspace uses this hook to feed `queueService.executeMethods` (which
   * decides between immediate and bulk-queued dispatch). Absent it, the
   * painter retains its standalone `/venues/availability` behavior of
   * firing `mutationRequest` synchronously with a success toast on ack.
   *
   * The optional second argument is a `resetOnSuccess` callback the caller
   * invokes ONLY after the server-side commit ack succeeds. This prevents
   * the painter from prematurely clearing its dirty state for a save that
   * gets rolled back server-side (e.g. ERR_SCHEDULE_CONFLICT).
   */
  onMutationMethods?: (
    methods: { method: string; params: any }[],
    resetOnSuccess: () => void,
  ) => void;
  /**
   * Fires when the painter's internal dirty state changes. The workspace
   * uses this hook to surface "painter has unsaved paint" in its sticky
   * action bar — aligning the painter's edit state with the bulk queue's
   * pending-batches count so the user has one consistent unsaved indicator.
   */
  onDirtyChange?: (isDirty: boolean) => void;
}

export function renderAvailabilityGrid(
  container: HTMLElement,
  options?: RenderAvailabilityGridOptions,
): AvailabilityGridInstance {
  const { tournamentRecord } = tournamentEngine.getTournament();

  const grid = createAvailabilityGrid(
    {
      tournamentRecord,
      showToolbar: true,
      showVenueTree: true,
      showCapacity: true,
      initialDay: options?.initialDay,
      labels: options?.labels,
      language: options?.language,
      onSetDefaultAvailability: options?.onSetDefaultAvailability,
      onSave: options?.onSave,
      onDirtyChange: options?.onDirtyChange,
      // Bridge the block popover's PRACTICE-only "Manage Registrations"
      // menu item into the TMX modal that owns the registration UI.
      // bookingId is derived deterministically from the engine block
      // descriptor — the factory's findPracticeBooking falls back to the
      // same `${courtId}-${date}-${startTime}` shape when the booking
      // lacks an explicit bookingId.
      onManageRegistrations: ({ courtId, date, startTime }) => {
        openManagePracticeRegistrationsModal({
          courtId,
          date,
          bookingId: `${courtId}-${date}-${startTime}`,
        });
      },
    },
    container,
  );

  return {
    grid,
    save: () => saveGridState(grid, options?.onMutationMethods),
    destroy: () => grid.destroy(),
  };
}

function buildCourtAvailabilityMethod(
  engine: any,
  tournamentRecord: any,
  venue: any,
  court: any,
  tournamentDays: string[],
): { method: string; params: any } | undefined {
  const courtRef = {
    tournamentId: tournamentRecord.tournamentId,
    venueId: venue.venueId,
    courtId: court.courtId,
  };

  const courtKeys = engine.getCourtAvailabilityKeys(courtRef);
  const hasOverrides = courtKeys.length > 0;

  const dateAvailability: any[] = [];
  let hasBlocks = false;

  for (const day of tournamentDays) {
    const dayBlocks = engine
      .getDayBlocks(day)
      .filter((block: any) => block.court.courtId === court.courtId && block.court.venueId === venue.venueId);

    if (dayBlocks.length) hasBlocks = true;

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
    if (hadPrevious) {
      return {
        method: MODIFY_COURT_AVAILABILITY,
        params: { courtId: court.courtId, dateAvailability: [] },
      };
    }
    return undefined;
  }

  if (dateAvailability.length) {
    return {
      method: MODIFY_COURT_AVAILABILITY,
      params: { courtId: court.courtId, dateAvailability },
    };
  }

  return undefined;
}

function saveGridState(
  grid: AvailabilityGrid,
  onMutationMethods?: (
    methods: { method: string; params: any }[],
    resetOnSuccess: () => void,
  ) => void,
): void {
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

    for (const court of venue.courts ?? []) {
      const courtMethod = buildCourtAvailabilityMethod(engine, tournamentRecord, venue, court, tournamentDays);
      if (courtMethod) methods.push(courtMethod);
    }
  }

  if (!methods.length) return;

  if (onMutationMethods) {
    // Workspace path: hand methods to queueService along with a
    // `resetOnSuccess` callback that the caller invokes only after the
    // server-side commit acks. Premature reset on failure would silently
    // mark the grid clean even though nothing persisted (the bug behind
    // the rolled-back ERR_SCHEDULE_CONFLICT case).
    onMutationMethods(methods, () => grid.resetDirtyState());
    return;
  }

  // Standalone /venues/availability path: direct mutationRequest with toast.
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
