/**
 * Rain-day recovery, T8 (Mentat planning/RAIN_DAY_RECOVERY_PLAN.md § 4a, CA 2026-11-23): a plan kept as times only.
 *
 * A director may want a plan's timing without its court assignments. Each placement with a date and a time keeps them
 * and its venue, and writes `courtId: ''` and `courtOrder: ''`. Committed (`applyScheduleScenario` →
 * `bulkScheduleMatchUps`), the empty court clears whatever court the matchUp holds. That matters for the carryover: a
 * court is stored with its day, but schedule reads do not filter by it, so a matchUp re-dated without a court would
 * keep the interrupted day's court. A placement with no date ("pull this matchUp off the grid") is kept as it is.
 *
 * Pure.
 */
export type Placement = { tournamentId: string; matchUpId: string; schedule: Record<string, any> };

export function timesOnlyPlacements(placements: Placement[]): Placement[] {
  return placements.map((placement) => {
    const { scheduledDate, scheduledTime, venueId } = placement.schedule ?? {};
    if (!scheduledDate || !scheduledTime) return placement;
    return {
      ...placement,
      schedule: { scheduledDate, scheduledTime, ...(venueId ? { venueId } : {}), courtId: '', courtOrder: '' },
    };
  });
}

/** whether any placement still assigns a court: what "Save times only" would remove */
export function placementsHoldCourts(placements: Placement[]): boolean {
  return placements.some(({ schedule }) => !!schedule?.courtId);
}
