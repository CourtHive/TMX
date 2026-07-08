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

/** Whether `date` is flagged as published in the supplied per-date list. */
export function isPublishedForDate(dates: ScheduleDate[], date: string): boolean {
  return !!dates.find((d) => d.date === date)?.isPublished;
}

/**
 * Small "published" dot — a filled green circle used beside a date's match
 * count to signal that its order of play is published. Empty string when not
 * published so callers can unconditionally concatenate it.
 */
export function publishedDotHtml(isPublished: boolean): string {
  if (!isPublished) return '';
  return (
    ' <span title="Order of play published" aria-label="Order of play published"' +
    ' style="display: inline-block; width: 7px; height: 7px; border-radius: 50%;' +
    ' background: var(--tmx-accent-green, #22c55e); vertical-align: middle;"></span>'
  );
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
export function dateButtonHtml(selectedDate: string, count: number, isPublished = false): string {
  const badge =
    count > 0
      ? ` <span style="font-size: 0.625rem; font-weight: 600; padding: 1px 6px; border-radius: 10px; background: rgba(127,127,127,0.25); color: currentColor;">${count}</span>`
      : '';
  return (
    `<i class="fa-solid fa-calendar-days" style="font-size: 0.75rem;"></i>${formatDateLabel(selectedDate)}` +
    badge +
    publishedDotHtml(isPublished) +
    ' <i class="fa-solid fa-chevron-down" style="font-size: 0.5625rem; opacity: 0.6;"></i>'
  );
}
