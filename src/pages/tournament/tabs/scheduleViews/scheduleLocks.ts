/**
 * Schedule locks — TMX-side helpers for the factory `matchUp.schedule.lock`.
 *
 * A director pins a marquee matchUp's placement so bulk and automated
 * scheduling cannot move it. **The factory is the authority**: it enforces the
 * lock at every mutation that writes or wipes placement and returns
 * `SCHEDULE_LOCKED` / `lockedMatchUpIds`. The predicate here is for DISPLAY and
 * for deciding when to ask the operator to confirm — it must agree with
 * `factory/src/query/matchUp/isScheduleLocked.ts`, whose two inertness rules it
 * mirrors:
 *
 *   1. inert once the matchUp reaches a completed status, and
 *   2. inert while there is no placement to guard.
 *
 * Divergence here is cosmetic (a lock glyph on a matchUp the engine no longer
 * treats as locked), never a difference in what actually gets moved.
 */
import { SET_MATCHUP_SCHEDULE_LOCK } from 'constants/mutationConstants';
import { factoryConstants } from 'tods-competition-factory';

// The same list the factory predicate tests against. Taken from the engine
// rather than courthive-components' isCompletedStatus so this module stays free
// of the UI bundle (which touches `document` at import time).
const COMPLETED_STATUSES = new Set<string>(factoryConstants.completedMatchUpStatuses);

/** Placement attributes a lock guards — mirrors SCHEDULE_LOCK_ATTRIBUTES in factory. */
const PLACEMENT_ATTRIBUTES = ['allocatedCourts', 'scheduledDate', 'scheduledTime', 'courtOrder', 'courtId', 'venueId'];

const isEmpty = (value: any): boolean =>
  value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length);

/** The `schedule` of a matchUp, a grid cell's cached data, or a table row. */
function scheduleOf(source: any): any {
  return source?.schedule ?? source?.matchUp?.schedule;
}

function statusOf(source: any): string | undefined {
  return source?.matchUpStatus ?? source?.matchUp?.matchUpStatus;
}

/** Does this matchUp carry a lock the engine would currently act on? */
export function isScheduleLocked(source: any): boolean {
  const schedule = scheduleOf(source);
  if (!schedule?.lock || typeof schedule.lock !== 'object') return false;
  const status = statusOf(source);
  if (status && COMPLETED_STATUSES.has(status)) return false;
  return PLACEMENT_ATTRIBUTES.some((attribute) => !isEmpty(schedule[attribute]));
}

/** Is a lock recorded at all, regardless of whether it currently bites? */
export function hasScheduleLockRecord(source: any): boolean {
  const lock = scheduleOf(source)?.lock;
  return !!lock && typeof lock === 'object';
}

export function scheduleLockReason(source: any): string | undefined {
  return scheduleOf(source)?.lock?.reason;
}

/**
 * Build the lock/unlock mutation. `lock: null` unlocks; an object pins the whole
 * placement. `lockedAt` is caller-supplied — the factory never stamps wall-clock.
 */
export function buildScheduleLockMethod({
  matchUpId,
  drawId,
  locked,
  reason,
}: {
  matchUpId: string;
  drawId: string;
  locked: boolean;
  reason?: string;
}): { method: string; params: any } {
  return {
    method: SET_MATCHUP_SCHEDULE_LOCK,
    params: {
      matchUpId,
      drawId,
      lock: locked ? { lockedAt: new Date().toISOString(), ...(reason ? { reason } : {}) } : null,
    },
  };
}

/**
 * Which matchUps a grid drop would move against a lock.
 *
 * A drop can move TWO matchUps — the dragged one and the occupant it displaces
 * or swaps with — so both must be considered before the operator is asked to
 * confirm. Returns the matchUpIds that are locked; empty means the drop needs no
 * confirmation.
 */
export function lockedInDrop({ dragged, occupant }: { dragged?: any; occupant?: any }): string[] {
  const locked: string[] = [];
  if (isScheduleLocked(dragged)) locked.push(dragged.matchUpId ?? dragged?.matchUp?.matchUpId);
  if (isScheduleLocked(occupant)) locked.push(occupant.matchUpId ?? occupant?.matchUp?.matchUpId);
  return locked.filter(Boolean);
}
