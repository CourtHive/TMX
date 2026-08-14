/**
 * Calendar-day helpers for seeding e2e fixtures.
 *
 * Why this exists: `new Date().toISOString().slice(0, 10)` is the **UTC** calendar day, and TMX's
 * scheduling surfaces render and filter by the **local** one. The two disagree for part of every
 * day — after ~20:00 in a UTC−4 zone, or before ~10:00 UTC in a far-eastern one — and in that
 * window a spec seeds a schedule onto a day the grid is not showing. The grid renders perfectly
 * and reports "Scheduled 0", so the spec times out waiting for a cell that was never going to
 * appear, and the failure looks like a broken drag-and-drop rather than a calendar bug.
 *
 * That cost an hour of bisecting on 2026-08-13 (stash, checkout, dev-server restart, sibling-build
 * check) before the clock turned out to be the variable. Seed days through here instead.
 *
 * See Mentat/planning/E2E_SCHEDULE2_UTC_LOCAL_DAY_MISMATCH.md.
 */

/** Format a Date as `YYYY-MM-DD` in the **local** zone — never via toISOString(). */
export function toLocalCalendarDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Today's calendar day as TMX sees it. Use for any seeded `startDate`, `endDate` or
 * `scheduledDate` that a spec later expects to find rendered.
 */
export function todayLocal(): string {
  return toLocalCalendarDay(new Date());
}

/** `todayLocal()` shifted by whole days — negative for the past. */
export function daysFromTodayLocal(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return toLocalCalendarDay(date);
}
