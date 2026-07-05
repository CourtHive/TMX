/**
 * Pure-helper coverage for the schedule date selector. The DOM construction
 * (button + tippy popover) and the onMutationApplied recompute subscription in
 * `scheduleDateSelector.ts` are covered by Playwright e2e (journey 59); jsdom /
 * happy-dom are deliberately NOT proposed
 * (see feedback_one_dom_test_layer_per_ecosystem.md).
 */
import { countForDate, dateButtonHtml, formatDateLabel } from './scheduleDateSelectorLogic';
import type { ScheduleDate } from 'courthive-components';
import { describe, expect, it } from 'vitest';

// 2026-07-15 is a Wednesday.
const D15 = '2026-07-15';
const D15_LABEL = 'Wed Jul 15';

function dates(): ScheduleDate[] {
  return [
    { date: D15, isActive: true, matchUpCount: 1 },
    { date: '2026-07-16', isActive: false, matchUpCount: 0 },
    { date: '2026-07-17', isActive: false, matchUpCount: 3 },
  ];
}

describe('scheduleDateSelectorLogic — countForDate', () => {
  it('returns the matchUpCount for the matching date', () => {
    expect(countForDate(dates(), D15)).toBe(1);
    expect(countForDate(dates(), '2026-07-17')).toBe(3);
  });

  it('returns 0 for a date present with a zero count', () => {
    expect(countForDate(dates(), '2026-07-16')).toBe(0);
  });

  it('returns 0 for a date absent from the list', () => {
    expect(countForDate(dates(), '2026-07-20')).toBe(0);
  });

  it('treats a missing matchUpCount as 0', () => {
    expect(countForDate([{ date: D15, isActive: true }], D15)).toBe(0);
  });
});

describe('scheduleDateSelectorLogic — formatDateLabel', () => {
  it('renders weekday + month + day', () => {
    expect(formatDateLabel(D15)).toBe(D15_LABEL);
  });

  it('anchors at noon so the calendar day never slips to the previous day', () => {
    // A date-only string parsed as UTC-midnight would render "Dec 31" west of
    // UTC; the noon anchor keeps it on Jan 1.
    expect(formatDateLabel('2026-01-01')).toBe('Thu Jan 1');
  });
});

describe('scheduleDateSelectorLogic — dateButtonHtml', () => {
  it('always renders the calendar icon, day label, and chevron', () => {
    const html = dateButtonHtml(D15, 0);
    expect(html).toContain('fa-calendar-days');
    expect(html).toContain(D15_LABEL);
    expect(html).toContain('fa-chevron-down');
  });

  it('omits the count badge when the count is 0', () => {
    expect(dateButtonHtml(D15, 0)).not.toContain('<span');
  });

  it('renders the count badge when the count is positive', () => {
    const html = dateButtonHtml(D15, 2);
    expect(html).toContain('<span');
    expect(html).toContain('>2</span>');
  });

  it('reflects a recomputed count — the badge transition the staleness fix guards', () => {
    // Simulates the recompute path: same selected date, fresh per-date counts.
    const before = dateButtonHtml(D15, countForDate(dates(), D15));
    expect(before).toContain('>1</span>');

    const recomputed: ScheduleDate[] = [{ date: D15, isActive: true, matchUpCount: 2 }];
    const after = dateButtonHtml(D15, countForDate(recomputed, D15));
    expect(after).toContain('>2</span>');
    expect(after).not.toContain('>1</span>');
  });
});
