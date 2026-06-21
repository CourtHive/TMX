/**
 * Schedule2 — court time/order inversion detector (TMX-only).
 *
 * With "time travels with the matchUp", dragging a matchUp around the grid can
 * leave a court's scheduledTimes out of order — a later `courtOrder` holding a
 * time that is equal to or earlier than a lower `courtOrder` on the same court.
 * The grid sequences by `courtOrder`, so this never breaks layout, but it reads
 * wrong on a printed Order of Play and usually means the times need an Apply
 * Times pass.
 *
 * The factory's `proConflicts` does NOT cover this: its court double-booking
 * check groups by court + courtOrder + date and ignores scheduledTime entirely.
 * Surfacing it in the engine would touch the auto-scheduler, so for now we
 * detect it here and add a soft WARN to the schedule2 issues panel. A future
 * engine enhancement is tracked in Mentat/TASKS.md (CONFLICT_COURT_TIME_ORDER).
 *
 * Pure and DOM-free so it can be unit-tested.
 */

export const CONFLICT_COURT_TIME_ORDER = 'courtTimeOrderConflict';

export interface TimedMatchUp {
  matchUpId: string;
  schedule?: { courtId?: string; courtOrder?: number | string; scheduledTime?: string } | null;
}

export interface CourtTimeOrderIssue {
  courtId: string;
  /** The later-courtOrder matchUp whose time is not strictly after the earlier one. */
  matchUpId: string;
  scheduledTime: string;
  /** The lower-courtOrder matchUp it is out of order with. */
  earlierMatchUpId: string;
  earlierScheduledTime: string;
}

/** Parse an `HH:MM` clock string to minutes-since-midnight; null when unparseable. */
export function parseClockMinutes(value?: string): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return hh * 60 + mm;
}

/**
 * Find court time/order inversions. Within each court, matchUps that have both a
 * `courtOrder` and a parseable `scheduledTime` are sorted by `courtOrder`; an
 * issue is reported whenever a matchUp's time is <= the previous (lower-order)
 * matchUp's time. Adjacent comparison detects every break in strict
 * monotonicity while keeping the output low-noise. MatchUps missing a time or
 * order are skipped (they don't break the chain); same-order pairs are left to
 * the engine's double-booking check.
 */
export function detectCourtTimeOrderIssues(matchUps: TimedMatchUp[]): CourtTimeOrderIssue[] {
  const byCourt = new Map<string, { matchUpId: string; order: number; minutes: number; time: string }[]>();

  for (const mu of matchUps) {
    const schedule = mu.schedule;
    if (!schedule?.courtId) continue;
    const order =
      typeof schedule.courtOrder === 'string' ? Number.parseInt(schedule.courtOrder, 10) : schedule.courtOrder;
    const minutes = parseClockMinutes(schedule.scheduledTime);
    if (order == null || Number.isNaN(order) || minutes == null) continue;
    const list = byCourt.get(schedule.courtId) ?? [];
    list.push({ matchUpId: mu.matchUpId, order, minutes, time: schedule.scheduledTime as string });
    byCourt.set(schedule.courtId, list);
  }

  const issues: CourtTimeOrderIssue[] = [];
  for (const [courtId, list] of byCourt) {
    list.sort((a, b) => a.order - b.order);
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const cur = list[i];
      if (cur.order === prev.order) continue; // same order = double-booking (engine's job)
      if (cur.minutes <= prev.minutes) {
        issues.push({
          courtId,
          matchUpId: cur.matchUpId,
          scheduledTime: cur.time,
          earlierMatchUpId: prev.matchUpId,
          earlierScheduledTime: prev.time,
        });
      }
    }
  }
  return issues;
}
