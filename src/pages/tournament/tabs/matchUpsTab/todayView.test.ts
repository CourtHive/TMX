import { TODAY_BUCKETS } from 'components/tables/common/filters/matchUpStatusPredicates';
import { aggregateToday, getTodaySegments, totalToday } from './todayView';
import { describe, expect, it } from 'vitest';

const DAY = '2026-08-16';
const OTHER_DAY = '2026-08-17';

// A call stamped at 14:00 LOCAL on the given day, expressed as the ISO instant
// the factory stores — keeps the expectations timezone-independent.
const calledAtOn = (isoDate: string) => new Date(`${isoDate}T14:00:00`).toISOString();

const row = (over: any = {}) => ({
  matchUpStatus: 'TO_BE_PLAYED',
  scheduledDate: DAY,
  readyToScore: false,
  complete: false,
  ...over,
});

describe('getTodaySegments', () => {
  // Guard: buildSegmentedBar renders and totals only the keys it is handed, so a
  // bucket added to the partition without a matching segment would vanish from
  // the bar and be dropped from its total with no other symptom.
  it('renders exactly one segment per Today bucket, in partition order', () => {
    expect(getTodaySegments().map((s) => s.key)).toEqual([...TODAY_BUCKETS]);
  });

  it('labels every segment and gives each a distinct colour', () => {
    const segments = getTodaySegments();
    expect(segments.every((s) => !!s.label && !s.label.includes('pages.matchUps'))).toBe(true);
    expect(new Set(segments.map((s) => s.color)).size).toBe(segments.length);
  });
});

describe('aggregateToday', () => {
  it('splits ready matchUps into called and readyToScore', () => {
    const items = [
      row({ readyToScore: true, calledAt: calledAtOn(DAY) }),
      row({ readyToScore: true, calledAt: calledAtOn(DAY) }),
      row({ readyToScore: true }),
      row({ matchUpStatus: 'COMPLETED', winningSide: 'side1', complete: true }),
      row({ matchUpStatus: 'IN_PROGRESS' }),
      row(),
    ];
    expect(aggregateToday(items, DAY)).toEqual({
      complete: 1,
      live: 1,
      suspended: 0,
      called: 2,
      readyToScore: 1,
      notReady: 1,
    });
  });

  it('counts only rows scheduled for the requested day', () => {
    const items = [
      row({ readyToScore: true, calledAt: calledAtOn(DAY) }),
      row({ scheduledDate: OTHER_DAY, readyToScore: true, calledAt: calledAtOn(OTHER_DAY) }),
      row({ scheduledDate: undefined, readyToScore: true }),
    ];
    const counts = aggregateToday(items, DAY);
    expect(counts.called).toBe(1);
    expect(totalToday(counts)).toBe(1);
  });

  it('reads Tabulator row objects as well as plain data', () => {
    const data = row({ readyToScore: true, calledAt: calledAtOn(DAY) });
    expect(aggregateToday([{ getData: () => data }], DAY).called).toBe(1);
  });

  it('returns zeroed counts for a non-array or empty input', () => {
    const zeroed = { complete: 0, live: 0, suspended: 0, called: 0, readyToScore: 0, notReady: 0 };
    expect(aggregateToday(undefined as any, DAY)).toEqual(zeroed);
    expect(aggregateToday([], DAY)).toEqual(zeroed);
    expect(totalToday(aggregateToday([], DAY))).toBe(0);
  });
});

describe('totalToday', () => {
  it('sums every bucket, including called', () => {
    const items = [
      row({ readyToScore: true, calledAt: calledAtOn(DAY) }),
      row({ readyToScore: true }),
      row({ matchUpStatus: 'SUSPENDED', score: '6-4 2-3' }),
    ];
    expect(totalToday(aggregateToday(items, DAY))).toBe(3);
  });
});
