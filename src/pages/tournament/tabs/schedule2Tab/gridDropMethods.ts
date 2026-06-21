/**
 * Schedule2 grid drag-and-drop — pure mutation builders.
 *
 * These functions hold the decision logic for what mutations a drop produces,
 * deliberately free of DOM and engine access so they can be unit-tested. The
 * `gridView` drop handlers extract coordinates from the DOM, call these, and
 * hand the resulting methods to `executeMethods`.
 *
 *  - buildGridDropMethods — dropping onto a court-grid cell. When the cell is
 *    occupied AND the drag originated from another grid cell with a known
 *    origin slot, the two matchUps trade court + courtOrder; each keeps its
 *    OWN scheduledTime (time travels with the matchUp — the grid is an
 *    organizational aid, not the definitive time, and proConflicts surfaces
 *    any resulting clashes). Otherwise the occupant (if any) is returned to
 *    the catalog and the dragged matchUp takes the target cell, carrying its
 *    own scheduledTime with it.
 *
 *  - shouldRejectStripDrop — whether a drop onto a court's "Now" strip cell
 *    should be refused. A matchUp dragged from the grid may only land on an
 *    EMPTY Now cell; an occupied Now cell is left untouched.
 */

import { ADD_MATCHUP_SCHEDULE_ITEMS } from 'constants/mutationConstants';

export type DragPayloadType = 'CATALOG_MATCHUP' | 'GRID_MATCHUP';

export interface GridDropSource {
  courtId?: string;
  venueId?: string;
  courtOrder?: number | string;
  scheduledTime?: string;
  scheduledDate?: string;
}

export interface GridDropPayload {
  type: DragPayloadType;
  matchUp: { matchUpId: string; drawId?: string };
  /** The dragged matchUp's origin slot — present only for GRID_MATCHUP drags. */
  source?: GridDropSource | null;
}

export interface GridDropTarget {
  courtId: string;
  venueId: string;
  courtOrder: number;
  /** The target cell occupant's scheduledTime, when occupied. */
  scheduledTime?: string;
}

export interface GridDropOccupant {
  matchUpId: string;
  drawId?: string;
}

export interface BuildGridDropMethodsParams {
  payload: GridDropPayload;
  target: GridDropTarget;
  /** The matchUp currently in the target cell, or null when the cell is empty. */
  occupant: GridDropOccupant | null;
  scheduledDate: string;
}

interface ScheduleMethod {
  method: string;
  params: { matchUpId: string; drawId: string; schedule: any; removePriorValues: boolean };
}

// `removePriorValues` clears whatever schedule fields aren't supplied, so an
// empty schedule unschedules a matchUp entirely (returns it to the catalog).
function clearSchedule(matchUpId: string, drawId: string): ScheduleMethod {
  return {
    method: ADD_MATCHUP_SCHEDULE_ITEMS,
    params: {
      matchUpId,
      drawId,
      schedule: { scheduledTime: '', scheduledDate: '', courtOrder: '', venueId: '', courtId: '' },
      removePriorValues: true,
    },
  };
}

function assignSchedule(matchUpId: string, drawId: string, schedule: any): ScheduleMethod {
  return { method: ADD_MATCHUP_SCHEDULE_ITEMS, params: { matchUpId, drawId, schedule, removePriorValues: true } };
}

/**
 * Build the mutation methods for a court-grid cell drop. Returns an empty array
 * when the drop is a no-op (a matchUp dropped onto the cell it already holds).
 */
export function buildGridDropMethods(params: BuildGridDropMethodsParams): ScheduleMethod[] {
  const { payload, target, occupant, scheduledDate } = params;
  const matchUp = payload.matchUp;

  // Dropped onto its own cell — nothing to do.
  if (occupant && occupant.matchUpId === matchUp.matchUpId) return [];

  const source = payload.type === 'GRID_MATCHUP' ? payload.source : null;
  const canSwap = !!(occupant && source && source.courtId && source.courtOrder != null);

  if (canSwap && occupant && source) {
    // Swap: the two matchUps trade court + courtOrder, but each KEEPS ITS OWN
    // scheduledTime (time travels with the matchUp). Clear both first so
    // neither assignment transiently collides on a shared court/order, then
    // place each into the other's slot carrying its own time.
    return [
      clearSchedule(occupant.matchUpId, occupant.drawId ?? ''),
      clearSchedule(matchUp.matchUpId, matchUp.drawId ?? ''),
      // Dragged matchUp → target slot, keeping its own time (from its origin).
      assignSchedule(matchUp.matchUpId, matchUp.drawId ?? '', {
        courtId: target.courtId,
        venueId: target.venueId,
        courtOrder: target.courtOrder,
        scheduledDate,
        scheduledTime: source.scheduledTime ?? '',
      }),
      // Displaced matchUp → the dragged matchUp's origin slot, keeping its own
      // time (the time it held while in the target cell).
      assignSchedule(occupant.matchUpId, occupant.drawId ?? '', {
        courtId: source.courtId,
        venueId: source.venueId ?? target.venueId,
        courtOrder: source.courtOrder,
        scheduledDate: source.scheduledDate || scheduledDate,
        scheduledTime: target.scheduledTime ?? '',
      }),
    ];
  }

  // No swap possible (catalog drag, or no source origin): unschedule any
  // occupant (returns it to the catalog), unschedule the dragged matchUp's
  // source, then place the dragged matchUp on the target cell.
  const methods: ScheduleMethod[] = [];
  if (occupant) methods.push(clearSchedule(occupant.matchUpId, occupant.drawId ?? ''));
  if (payload.type === 'GRID_MATCHUP') methods.push(clearSchedule(matchUp.matchUpId, matchUp.drawId ?? ''));
  const placed: any = {
    courtOrder: target.courtOrder,
    scheduledDate,
    courtId: target.courtId,
    venueId: target.venueId,
  };
  // Time travels with the matchUp: a grid-sourced drag carries its own
  // scheduledTime to the new cell. Catalog items have no time to carry.
  if (payload.type === 'GRID_MATCHUP') placed.scheduledTime = source?.scheduledTime ?? '';
  methods.push(assignSchedule(matchUp.matchUpId, matchUp.drawId ?? '', placed));
  return methods;
}

export interface StripDropRejectionParams {
  payloadType: DragPayloadType;
  draggedMatchUpId: string;
  /** True when the court's Now-strip cell already surfaces a matchUp (not free). */
  cellOccupied: boolean;
  /** The matchUpId currently shown in the Now cell, when occupied. */
  occupantMatchUpId?: string | null;
}

/**
 * Whether a drop onto a court's Now-strip cell should be rejected. Only
 * grid-sourced drags are constrained — and only when the Now cell is occupied
 * by a *different* matchUp. Catalog drags and re-dropping the same matchUp are
 * always allowed.
 */
export function shouldRejectStripDrop(params: StripDropRejectionParams): boolean {
  if (params.payloadType !== 'GRID_MATCHUP') return false;
  if (!params.cellOccupied) return false;
  return params.occupantMatchUpId !== params.draggedMatchUpId;
}
