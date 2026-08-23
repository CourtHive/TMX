import { normalizeTimes, toDayMinutesFromClock, toDayMinutesFromInstant } from './inspectorRest';
import { describe, expect, it } from 'vitest';

// constants and types
import type { ReadinessMatchUp } from './matchUpReadiness';

const DATE = '2026-08-22';

/**
 * `pnpm test` pins `TZ=UTC`, but these assertions are deliberately written to
 * hold in ANY zone: every instant is built by parsing a naive local datetime and
 * re-serialising it, so the expected minute figure is a statement about local
 * wall clock rather than about UTC. Running `vitest` directly (no `TZ=UTC`) must
 * produce the same result — that was not true of the first draft of this file,
 * and the difference is exactly the offset bug the feature has to avoid.
 */

/** An ISO instant that IS `hh:mm` in the runner's local zone on `date`. */
function localInstant(date: string, hhmm: string): string {
  return new Date(`${date}T${hhmm}:00`).toISOString();
}
describe('toDayMinutesFromClock — bare wall clock, sliced never converted', () => {
  it('parses military HH:MM', () => {
    expect(toDayMinutesFromClock('00:00')).toBe(0);
    expect(toDayMinutesFromClock('09:05')).toBe(545);
    expect(toDayMinutesFromClock('14:20')).toBe(860);
    expect(toDayMinutesFromClock('23:59')).toBe(1439);
  });

  it('slices the naive wall-clock portion of an ISO string, matching the factory extractTime', () => {
    expect(toDayMinutesFromClock('2026-08-22T14:20:00.000Z')).toBe(860);
    expect(toDayMinutesFromClock('2026-08-22T14:20')).toBe(860);
  });

  it('rejects unparseable and out-of-range values rather than guessing', () => {
    for (const value of [undefined, '', 'later', '24:00', '12:60', 'TBD']) {
      expect(toDayMinutesFromClock(value)).toBeUndefined();
    }
  });
});

describe('toDayMinutesFromInstant — UTC instant against local midnight of the viewed day', () => {
  it('converts an instant on the viewed day to its local wall-clock minute', () => {
    expect(toDayMinutesFromInstant(localInstant(DATE, '13:48'), DATE)).toBe(828);
    expect(toDayMinutesFromInstant(localInstant(DATE, '00:00'), DATE)).toBe(0);
  });

  it('is a conversion, not a string slice — a UTC stamp is NOT read as wall clock', () => {
    // In a zone offset from UTC these two disagree; asserting they agree only
    // when the offset is zero is what makes this a real falsifier rather than a
    // restatement of the implementation.
    const utcNoon = '2026-08-22T12:00:00.000Z';
    const offsetMinutes = -new Date(`${DATE}T00:00:00`).getTimezoneOffset();
    expect(toDayMinutesFromInstant(utcNoon, DATE)).toBe(720 + offsetMinutes);
  });

  it('returns a NEGATIVE value for an instant on the previous day', () => {
    // A string slice could never produce this; it is the falsifier for the
    // instant-vs-wall-clock distinction the whole feature depends on.
    expect(toDayMinutesFromInstant(localInstant('2026-08-21', '22:30'), DATE)).toBe(-90);
  });

  it('returns a value ABOVE 1439 for an instant on the following day', () => {
    expect(toDayMinutesFromInstant(localInstant('2026-08-23', '00:30'), DATE)).toBe(1470);
  });

  it('returns undefined for a missing instant, a missing date, or an unparseable stamp', () => {
    expect(toDayMinutesFromInstant(undefined, DATE)).toBeUndefined();
    expect(toDayMinutesFromInstant(localInstant(DATE, '13:48'), null)).toBeUndefined();
    expect(toDayMinutesFromInstant('not-a-date', DATE)).toBeUndefined();
    expect(toDayMinutesFromInstant(localInstant(DATE, '13:48'), 'not-a-date')).toBeUndefined();
  });
});

describe('normalizeTimes', () => {
  function matchUp(schedule: ReadinessMatchUp['schedule']): ReadinessMatchUp {
    return { matchUpId: 'm1', schedule };
  }

  it('normalizes each field from its own frame', () => {
    const result = normalizeTimes(
      matchUp({
        scheduledDate: DATE,
        scheduledTime: '10:00',
        startTime: '10:07',
        endTime: '12:06',
        calledAt: localInstant(DATE, '09:55'),
        scoredTime: localInstant(DATE, '12:11'),
      }),
      DATE,
    );

    expect(result).toEqual({
      endMinutes: 726,
      scoredMinutes: 731,
      startMinutes: 607,
      calledMinutes: 595,
      scheduledMinutes: 600,
    });
  });

  it('rolls endTime onto the next day when END_DATE says the match crossed midnight', () => {
    const result = normalizeTimes(
      matchUp({ scheduledDate: DATE, scheduledTime: '22:30', endTime: '00:40', endDate: '2026-08-23' }),
      DATE,
    );
    expect(result.endMinutes).toBe(1480);
    expect(result.scheduledMinutes).toBe(1350);
  });

  it('does not roll endTime when END_DATE equals the scheduled date', () => {
    const result = normalizeTimes(matchUp({ scheduledDate: DATE, endTime: '12:06', endDate: DATE }), DATE);
    expect(result.endMinutes).toBe(726);
  });

  it('omits endMinutes entirely when no END_TIME was recorded — the common case', () => {
    const result = normalizeTimes(matchUp({ scheduledDate: DATE, scoredTime: localInstant(DATE, '12:11') }), DATE);
    expect(result.endMinutes).toBeUndefined();
    expect(result.scoredMinutes).toBe(731);
  });

  it('yields nothing usable for a matchUp with no schedule at all', () => {
    const result = normalizeTimes({ matchUpId: 'm1', schedule: null }, DATE);
    expect(Object.values(result).every((value) => value === undefined)).toBe(true);
  });
});
