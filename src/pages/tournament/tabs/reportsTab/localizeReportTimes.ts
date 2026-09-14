import { venueParts, venueWallClockToMs } from 'functions/venueTimeFrame';

const MS_PER_MINUTE = 60_000;

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * Recompute any UTC timestamps a report carries (rows with a `calledAtIso`
 * field, e.g. Call Timing Variance) into the **venue's** wall clock, resolved
 * per instant so a tournament spanning a DST change reads correctly on both
 * sides of it.
 *
 * `calledAt` becomes a bare HH:mm (date-prefixed only when the call landed on a
 * different venue calendar day than the scheduled date); `varianceMinutes` is
 * the signed difference between the actual call instant and the planned time.
 *
 * The variance is the reason `scheduledTime` cannot simply be `new Date`d. It is
 * a bare venue wall clock; parsing it without a zone yields the operator's
 * instant, and subtracting that from a real instant produced a variance wrong by
 * the offset between laptop and venue — a "12 minutes late" that was actually on
 * time. `venueWallClockToMs` resolves it against the venue zone instead.
 *
 * ── The pre-stage floor is part of the contract, not an optimisation ──
 *
 * A `calledAt` whose venue-local calendar day PRECEDES `scheduledDate` was not a
 * late or early call against its plan: the matchUp was staged onto the "Now"
 * strip on an earlier day, or was called on one day and then re-dated to
 * another without the stamp being retired. Those report 0, and the timestamp is
 * still shown date-prefixed so an operator can see what happened.
 *
 * The factory's `scheduling.callTimingVariance` wrapper already applies exactly
 * this rule and returns 0 for such rows. Until now this function recomputed
 * `varianceMinutes` unconditionally and **overwrote that 0** with the raw
 * difference — so four re-dated quarterfinals in a live tournament reported
 * −1009 and −1026 minutes, swamping the column they sit in. Anything that
 * recomputes the variance must reapply the floor, or it silently reverts the
 * wrapper.
 */
export function localizeReportTimes(rows: Record<string, any>[], timeZone?: string): void {
  for (const row of rows ?? []) {
    if (!row.calledAtIso) continue;
    const parts = venueParts(row.calledAtIso, timeZone);
    if (!parts) continue;

    const localDate = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
    const localTime = `${pad(parts.hour)}:${pad(parts.minute)}`;
    row.calledAt = localDate === row.scheduledDate ? localTime : `${localDate} ${localTime}`;

    if (row.scheduledDate && row.scheduledTime) {
      const calledMs = new Date(row.calledAtIso).getTime();
      const plannedMs = venueWallClockToMs(row.scheduledDate, row.scheduledTime, timeZone);
      if (plannedMs !== undefined && !Number.isNaN(calledMs)) {
        // Compare at whole-minute resolution so the number agrees with the HH:mm
        // shown: a call at 15:05:45 displays as 15:05, so 15:00 → 15:05 reads as
        // 5, not 6 (which a seconds-aware round would give).
        const variance = Math.floor(calledMs / MS_PER_MINUTE) - Math.floor(plannedMs / MS_PER_MINUTE);
        row.varianceMinutes = localDate < row.scheduledDate ? 0 : variance;
      }
    }
  }
}
