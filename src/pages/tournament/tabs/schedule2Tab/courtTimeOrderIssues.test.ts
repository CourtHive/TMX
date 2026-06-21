import { describe, it, expect } from 'vitest';

import { detectCourtTimeOrderIssues, parseClockMinutes, type TimedMatchUp } from './courtTimeOrderIssues';

const mu = (matchUpId: string, courtId: string, courtOrder: number | string, scheduledTime?: string): TimedMatchUp => ({
  matchUpId,
  schedule: { courtId, courtOrder, scheduledTime },
});

describe('parseClockMinutes', () => {
  it('parses HH:MM to minutes since midnight', () => {
    expect(parseClockMinutes('00:00')).toBe(0);
    expect(parseClockMinutes('09:30')).toBe(570);
    expect(parseClockMinutes('23:59')).toBe(1439);
  });
  it('returns null for missing or malformed values', () => {
    expect(parseClockMinutes(undefined)).toBeNull();
    expect(parseClockMinutes('')).toBeNull();
    expect(parseClockMinutes('9am')).toBeNull();
    expect(parseClockMinutes('24:00')).toBeNull();
    expect(parseClockMinutes('10:75')).toBeNull();
  });
});

describe('detectCourtTimeOrderIssues', () => {
  it('reports no issues when times increase with courtOrder', () => {
    const issues = detectCourtTimeOrderIssues([
      mu('a', 'c1', 1, '08:00'),
      mu('b', 'c1', 2, '09:00'),
      mu('c', 'c1', 3, '10:30'),
    ]);
    expect(issues).toEqual([]);
  });

  it('flags a later courtOrder with an earlier time (inversion)', () => {
    const issues = detectCourtTimeOrderIssues([mu('a', 'c1', 1, '14:00'), mu('b', 'c1', 2, '09:00')]);
    expect(issues).toEqual([
      {
        courtId: 'c1',
        matchUpId: 'b',
        scheduledTime: '09:00',
        earlierMatchUpId: 'a',
        earlierScheduledTime: '14:00',
      },
    ]);
  });

  it('flags equal times on the same court at different orders', () => {
    const issues = detectCourtTimeOrderIssues([mu('a', 'c1', 1, '09:00'), mu('b', 'c1', 2, '09:00')]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ matchUpId: 'b', earlierMatchUpId: 'a' });
  });

  it('compares against the previous TIMED matchUp, skipping untimed gaps', () => {
    const issues = detectCourtTimeOrderIssues([
      mu('a', 'c1', 1, '10:00'),
      mu('b', 'c1', 2, undefined), // no time — skipped, does not break the chain
      mu('c', 'c1', 3, '09:00'), // 09:00 <= 10:00 → inversion vs 'a'
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ matchUpId: 'c', earlierMatchUpId: 'a', earlierScheduledTime: '10:00' });
  });

  it('evaluates each court independently and sorts by courtOrder', () => {
    const issues = detectCourtTimeOrderIssues([
      // provided out of order; c1 is monotonic, c2 inverts
      mu('b', 'c1', 2, '11:00'),
      mu('a', 'c1', 1, '10:00'),
      mu('y', 'c2', 2, '08:00'),
      mu('x', 'c2', 1, '12:00'),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ courtId: 'c2', matchUpId: 'y', earlierMatchUpId: 'x' });
  });

  it('ignores matchUps without a court, order, or parseable time', () => {
    const issues = detectCourtTimeOrderIssues([
      { matchUpId: 'noCourt', schedule: { courtOrder: 1, scheduledTime: '09:00' } },
      { matchUpId: 'noSchedule', schedule: null },
      mu('noTime', 'c1', 1, undefined),
      mu('badTime', 'c1', 2, 'noon'),
    ]);
    expect(issues).toEqual([]);
  });

  it('accepts string courtOrder values', () => {
    const issues = detectCourtTimeOrderIssues([mu('a', 'c1', '1', '10:00'), mu('b', 'c1', '2', '09:00')]);
    expect(issues).toHaveLength(1);
    expect(issues[0].matchUpId).toBe('b');
  });

  it('reports each consecutive decrease in a chain of inversions', () => {
    const issues = detectCourtTimeOrderIssues([
      mu('a', 'c1', 1, '12:00'),
      mu('b', 'c1', 2, '11:00'), // < a
      mu('c', 'c1', 3, '10:00'), // < b
    ]);
    expect(issues).toHaveLength(2);
    expect(issues.map((i) => [i.matchUpId, i.earlierMatchUpId])).toEqual([
      ['b', 'a'],
      ['c', 'b'],
    ]);
  });

  it('does not re-flag after a recovery to a later time', () => {
    // 10:00, 09:00 (inversion), 09:30 (> 09:00 — fine again)
    const issues = detectCourtTimeOrderIssues([
      mu('a', 'c1', 1, '10:00'),
      mu('b', 'c1', 2, '09:00'),
      mu('c', 'c1', 3, '09:30'),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ matchUpId: 'b', earlierMatchUpId: 'a' });
  });
});
