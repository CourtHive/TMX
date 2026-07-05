/**
 * Pure rendering helpers for the schedule date selector.
 *
 * Kept DOM-free so they can be unit-tested in the default node vitest env. The
 * DOM construction (button, tippy popover) + the `onMutationApplied` recompute
 * subscription live in `scheduleDateSelector.ts`; that behaviour is covered by
 * Playwright e2e (journey 59). happy-dom/jsdom are deliberately NOT introduced
 * — Playwright is this ecosystem's single DOM test layer
 * (see feedback_one_dom_test_layer_per_ecosystem.md).
 */
import { ScheduleDate } from 'courthive-components';

/** Match-count for `date` within the supplied per-date counts (0 when absent). */
export function countForDate(dates: ScheduleDate[], date: string): number {
  return dates.find((d) => d.date === date)?.matchUpCount ?? 0;
}

/**
 * Weekday + month + day label, e.g. "Wed Jul 15". Anchored at noon so a
 * date-only string never renders the previous day west of UTC
 * (see calendar_day_utc_parse_offbyone).
 */
export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.toLocaleDateString('en-US', { weekday: 'short' });
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const date = d.getDate();
  return `${day} ${month} ${date}`;
}

/**
 * Inner HTML for the selector button: calendar icon + day label + optional
 * count badge (hidden when the count is 0) + chevron. The single source of the
 * badge markup that previously diverged across the two headers.
 */
export function dateButtonHtml(selectedDate: string, count: number): string {
  const badge =
    count > 0
      ? ` <span style="font-size: 0.625rem; font-weight: 600; padding: 1px 6px; border-radius: 10px; background: rgba(127,127,127,0.25); color: currentColor;">${count}</span>`
      : '';
  return (
    `<i class="fa-solid fa-calendar-days" style="font-size: 0.75rem;"></i>${formatDateLabel(selectedDate)}` +
    badge +
    ' <i class="fa-solid fa-chevron-down" style="font-size: 0.5625rem; opacity: 0.6;"></i>'
  );
}
