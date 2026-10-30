import { datesWithinBounds, matchUpMenuGates, timeOutsideBounds } from './matchUpMenuGates';
import { describe, expect, it } from 'vitest';

// The popover offers an item exactly when the factory's `matchUpActions` offers its action (CA, 2026-10-30). These
// fixtures are the actions' shapes (factory #5988); `scheduleMatchUpActions.test.ts` there covers which are offered.

const toBePlayed = { matchUpStatus: 'TO_BE_PLAYED', sides: [{ participantId: 'p1' }, { participantId: 'p2' }] };
const actions = (...types: string[]) => types.map((type) => ({ type }));

const day1 = '2026-10-01';
const day2 = '2026-10-02';
const day3 = '2026-10-03';

describe('matchUpMenuGates', () => {
  it('offers an item exactly when its action is offered', () => {
    const gates = matchUpMenuGates({
      matchUp: toBePlayed,
      validActions: actions('REFEREE', 'SCHEDULE_DATE', 'SCHEDULE_TIME', 'START', 'END', 'CHECK_IN'),
    });
    expect(Object.keys(gates).filter((key) => key !== 'hidePrint' && gates[key])).toEqual([
      'scheduleDate',
      'scheduleTime',
      'checkIn',
      'referee',
      'start',
      'end',
    ]);
    expect(gates.clearSchedule).toBeUndefined();
    expect(gates.scheduleLock).toBeUndefined();
    expect(gates.scorekeeper).toBeUndefined();
  });

  it('offers nothing the factory does not, as a factory that predates the actions', () => {
    const gates = matchUpMenuGates({ matchUp: toBePlayed, validActions: actions('SCORE', 'STATUS', 'SCHEDULE') });
    expect(Object.values(gates).filter((value) => typeof value === 'object')).toEqual([]);
  });

  it('carries the lock direction and the bounds of the actions', () => {
    const bounds = { earliestDate: day1 };
    const gates = matchUpMenuGates({
      matchUp: toBePlayed,
      validActions: [
        { type: 'SCHEDULE_LOCK', scheduleLocked: true },
        { type: 'SCHEDULE_DATE', bounds },
      ],
    });
    expect(gates.scheduleLock?.scheduleLocked).toBe(true);
    expect(gates.scheduleDate?.bounds).toBe(bounds);
  });

  // print is TMX's own: only a match still to be played gets a card
  it('prints a card only for a match still to be played', () => {
    expect(matchUpMenuGates({ matchUp: toBePlayed }).hidePrint).toBe(false);
    expect(matchUpMenuGates({ matchUp: { ...toBePlayed, matchUpStatus: 'IN_PROGRESS' } }).hidePrint).toBe(false);
    expect(matchUpMenuGates({ matchUp: { matchUpStatus: 'COMPLETED', winningSide: 1 } }).hidePrint).toBe(true);
    expect(matchUpMenuGates({ matchUp: { matchUpStatus: 'COMPLETED' } }).hidePrint).toBe(true);
    expect(matchUpMenuGates({ matchUp: { matchUpStatus: 'DOUBLE_WALKOVER' } }).hidePrint).toBe(true);
    expect(matchUpMenuGates({ matchUp: { matchUpStatus: 'BYE' } }).hidePrint).toBe(true);
    expect(matchUpMenuGates({ matchUp: undefined }).hidePrint).toBe(true);
  });
});

describe('datesWithinBounds', () => {
  const dates = [day1, day2, day3, '2026-10-04'];
  it('keeps the dates between the earliest and latest, inclusive', () => {
    expect(datesWithinBounds(dates, { earliestDate: day2, latestDate: day3 })).toEqual([day2, day3]);
    expect(datesWithinBounds(dates, { latestDate: day1 })).toEqual([day1]);
    expect(datesWithinBounds(dates, undefined)).toEqual(dates);
  });
});

describe('timeOutsideBounds', () => {
  const bounds = {
    scheduledAfter: { date: day2, time: '10:00', inclusive: false },
    scheduledBefore: { date: day3, time: '12:00', inclusive: false },
    recordedAfter: { date: day2, time: '11:30', inclusive: true },
  };

  it('judges a scheduled time against the bound on its own date only', () => {
    expect(timeOutsideBounds({ bounds, date: day2, time: '10:00' })?.key).toBe('toasts.schedule.timeBeforeBound');
    expect(timeOutsideBounds({ bounds, date: day2, time: '10:01' })).toBeUndefined();
    expect(timeOutsideBounds({ bounds, date: day3, time: '12:00' })?.key).toBe('toasts.schedule.timeAfterBound');
    expect(timeOutsideBounds({ bounds, date: day3, time: '09:00' })).toBeUndefined();
    expect(timeOutsideBounds({ bounds, date: day1, time: '23:00' })).toBeUndefined();
  });

  it('judges a start or end against the recorded bounds, where an equal time is allowed', () => {
    expect(timeOutsideBounds({ bounds, date: day2, time: '11:30', recorded: true })).toBeUndefined();
    expect(timeOutsideBounds({ bounds, date: day2, time: '11:29', recorded: true })?.bound).toBe(bounds.recordedAfter);
  });

  it('proves nothing without a date', () => {
    expect(timeOutsideBounds({ bounds, time: '09:00' })).toBeUndefined();
  });
});
