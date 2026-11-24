/**
 * Rain-day recovery, "Save as plan" (Mentat planning/RAIN_DAY_RECOVERY_PLAN.md § 4.6): one projection as a schedule
 * scenario's placements. Pure.
 *
 * - Each matchUp the run placed takes the target date, its projected time and its venue. Grid placements keep their court and order.
 *   Profile placements explicitly clear any previous court and order, including the interrupted day's.
 * - A carryover matchUp the day had no time for gets an empty placement: made official, it leaves the interrupted day,
 *   so it no longer holds back the rounds that feed it. It waits, undated, for another day.
 * - A target-day matchUp the run had no time for is left out of the plan, so it keeps its imported schedule: the plan
 *   never silently takes a matchUp off the day it was given.
 */
// constants and types
import type { RecoveryRunResult } from './recoveryComparison';
import type { RecoveryMatchUp } from './recoveryProfile';
import type { Placement } from './timesOnly';

type RecoveryPlacementsArgs = {
  result: RecoveryRunResult;
  scheduleDate: string;
  carryover: RecoveryMatchUp[];
  targetDay: RecoveryMatchUp[];
};

export function recoveryPlacements({
  result,
  scheduleDate,
  carryover,
  targetDay,
}: RecoveryPlacementsArgs): Placement[] {
  const tournamentIdOf = new Map(
    [...carryover, ...targetDay].map(({ matchUpId, tournamentId }) => [matchUpId, tournamentId]),
  );

  const placed: Placement[] = [];
  const placedIds = new Set<string>();
  for (const [venueId, venuePlacements] of Object.entries(result.placements?.[scheduleDate] ?? {})) {
    for (const { matchUpId, scheduleTime, courtId, courtOrder } of venuePlacements) {
      const tournamentId = tournamentIdOf.get(matchUpId);
      // a matchUp the recovery was not asked about (already timed on the day, outside the carryover and the target
      // day) is not the plan's to move
      if (!tournamentId) continue;
      placed.push({
        tournamentId,
        matchUpId,
        schedule: {
          scheduledDate: scheduleDate,
          scheduledTime: scheduleTime,
          venueId,
          courtId: courtId ?? '',
          courtOrder: courtOrder ?? '',
        },
      });
      placedIds.add(matchUpId);
    }
  }

  const undated: Placement[] = carryover
    .filter(({ matchUpId, tournamentId }) => tournamentId && !placedIds.has(matchUpId))
    .map(({ matchUpId, tournamentId }) => ({ tournamentId: tournamentId as string, matchUpId, schedule: {} }));

  return [...placed, ...undated];
}
