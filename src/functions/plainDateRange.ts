/**
 * Every calendar day from `startDate` to `endDate`, inclusive, as `YYYY-MM-DD`.
 *
 * A **plain date** in the Temporal sense — a day on a calendar, with no zone
 * and no instant behind it. Named for that concept deliberately: the ecosystem
 * is standardising the vocabulary ahead of the factory's Temporal migration, so
 * this becomes a `Temporal.PlainDate` walk rather than a rename.
 *
 * ── Why this is not three lines inline ──
 *
 * It was, in three places, and two of them were wrong the same way:
 *
 * ```ts
 * const current = new Date(`${start}T00:00:00`);   // LOCAL midnight
 * dates.push(current.toISOString().slice(0, 10));  // the UTC day
 * ```
 *
 * A zone-less datetime string parses as local midnight, and `toISOString()`
 * then reports the day in UTC. **East of UTC those are different days.**
 * Measured across four zones for `2026-09-12`..`2026-09-15`:
 *
 * | TZ | emitted |
 * |---|---|
 * | `UTC` | 09-12 09-13 09-14 09-15 |
 * | `America/New_York` | 09-12 09-13 09-14 09-15 |
 * | `Europe/Berlin` | **09-11** 09-12 09-13 **09-14** |
 * | `Pacific/Auckland` | **09-11** 09-12 09-13 **09-14** |
 *
 * So for an operator east of UTC the schedule's date selector offered a day
 * before the tournament started and never offered its last day. Every developer
 * machine and CI runner in this ecosystem sits at UTC or west of it, which is
 * why a green board has never once expressed it — see the calendar-day-intents
 * entry in `Mentat/TASKS.md`.
 *
 * The arithmetic below is the version `maybeNudgeActiveDates` already had
 * right: components in, `Date.UTC` throughout, components out. Nothing here
 * touches a wall clock, so nothing here can be moved by a zone or by a DST
 * transition — a UTC day is always exactly 24 hours, which is the property the
 * `setDate()` walk was relying on and did not have.
 *
 * NOT a substitute for `venueTimeFrame`. That module answers "what day is it at
 * the venue", which needs a zone and an instant. This one walks days that are
 * already days.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * The UTC components of an instant this module built at UTC midnight.
 *
 * Written out rather than `toISOString().slice(0, 10)` — which would be
 * *correct* here, since the instant is a UTC midnight by construction, and
 * would still be the one expression the ecosystem is trying to stop reading
 * past. Saying "UTC components" in the code costs three lines and leaves
 * nothing for the next reader, or the planned lint rule, to adjudicate.
 */
function toPlainDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

/**
 * Inclusive of both ends. Empty when either bound is missing or unreadable, or
 * when `endDate` precedes `startDate` — an empty range is the honest answer to
 * a range that does not exist, and every caller here already renders "no dates"
 * for it.
 */
export function plainDateRange(startDate?: string, endDate?: string): string[] {
  const start = ISO_DATE.exec(startDate?.trim() ?? '');
  const end = ISO_DATE.exec(endDate?.trim() ?? '');
  if (!start || !end) return [];

  const cursor = Date.UTC(Number(start[1]), Number(start[2]) - 1, Number(start[3]));
  const last = Date.UTC(Number(end[1]), Number(end[2]) - 1, Number(end[3]));
  if (Number.isNaN(cursor) || Number.isNaN(last) || last < cursor) return [];

  const dates: string[] = [];
  for (let day = cursor; day <= last; day += MS_PER_DAY) {
    dates.push(toPlainDate(new Date(day)));
  }
  return dates;
}
