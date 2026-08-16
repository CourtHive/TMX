/**
 * Schedule locks — TMX-side helpers for the factory `matchUp.schedule.lock`.
 *
 * A director pins a marquee matchUp's placement so bulk and automated
 * scheduling cannot move it. **The factory is the authority** in both senses:
 * it enforces the lock at every mutation that writes or wipes placement, and
 * since factory #4638 it also *answers* whether a matchUp is locked. This module
 * no longer re-implements the rules — `isScheduleLocked` delegates to
 * `scheduleGovernor.matchUpScheduleLocked`, the same predicate the enforcement
 * path uses, so the affordance cannot claim a lock the engine would ignore.
 *
 * The governor's pure form is called directly (not through the engine) because
 * a table renders hundreds of rows and must not resolve each one by id — the
 * same reason TMX already calls `scoreGovernor.checkScoreHasValue`.
 */
import { SET_MATCHUP_SCHEDULE_LOCK } from 'constants/mutationConstants';
import { scheduleGovernor } from 'tods-competition-factory';

/** The `schedule` of a matchUp, a grid cell's cached data, or a table row. */
function scheduleOf(source: any): any {
  return source?.schedule ?? source?.matchUp?.schedule;
}

/**
 * Does this matchUp carry a lock the engine would currently act on?
 *
 * Accepts a matchUp, a grid cell's cached data, or a table row — grid cells nest
 * the matchUp one level down, so unwrap before asking the factory.
 */
export function isScheduleLocked(source: any): boolean {
  const matchUp = source?.schedule ? source : (source?.matchUp ?? source);
  return !!matchUp && scheduleGovernor.matchUpScheduleLocked({ matchUp });
}

/**
 * Should a Lock / Unlock control be offered for this matchUp at all?
 *
 * Exactly when a lock would mean something: the matchUp is **not completed** and
 * **actually has a placement** to guard. Rather than re-listing those rules
 * here, this asks the factory the counterfactual — *if this matchUp carried a
 * lock, would the engine act on it?* — by probing the predicate with a synthetic
 * one. Both the placement-attribute list and the completed-status list stay in
 * the engine, where enforcement reads them.
 */
export function canToggleScheduleLock(source: any): boolean {
  const matchUp = source?.schedule ? source : (source?.matchUp ?? source);
  if (!matchUp?.drawId || matchUp.winningSide) return false;
  return scheduleGovernor.matchUpScheduleLocked({
    matchUp: { ...matchUp, schedule: { ...matchUp.schedule, lock: {} } },
  });
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
