import { compareRecovery, type RecoveryRunResult } from './recoveryComparison';
import { describe, expect, it } from 'vitest';

const DAY = '2026-11-22';
const VENUE = 'venue';

const roundKey = { tournamentId: 't', eventId: 'e', drawId: 'd', structureId: 's' };
const carried = (matchUpId: string) => ({ ...roundKey, roundNumber: 1, matchUpId });
const imported = (matchUpId: string, scheduledTime?: string) => ({
  ...roundKey,
  roundNumber: 2,
  matchUpId,
  schedule: { venueId: VENUE, ...(scheduledTime ? { scheduledTime } : {}) },
});
const run = (placed: [string, string][], noTime: string[] = []): RecoveryRunResult => ({
  placements: { [DAY]: { [VENUE]: placed.map(([matchUpId, scheduleTime]) => ({ matchUpId, scheduleTime })) } },
  noTimeMatchUpIds: { [DAY]: noTime },
});

/** the prototype's three figures on one fixture: 3 carried, 4 imported (2 at 10:00, 2 at 13:00), 1 left over */
function fixture() {
  const carryover = [carried('c1'), carried('c2'), carried('c3')];
  const targetDay = [
    imported('t1', '10:00'),
    imported('t2', '10:00'),
    imported('t3', '13:00'),
    imported('t4', '13:00'),
  ];
  const result = run(
    [
      ['c1', '08:00'],
      ['c2', '08:00'],
      ['c3', '09:30'],
      ['t1', '10:00'],
      ['t2', '11:30'],
      ['t3', '13:00'],
    ],
    ['t4'],
  );
  const averageMinutes = { c1: 90, c2: 90, c3: 90, t1: 90, t2: 90, t3: 90, t4: 90 };
  return { carryover, targetDay, result, averageMinutes };
}

describe('compareRecovery', () => {
  it("reads the prototype's summary: carryover finish, starts that hold, matchUps beyond the day", () => {
    const comparison = compareRecovery({ ...fixture(), scheduleDate: DAY });

    // 09:30 + 90 minutes: the latest carryover end, not the latest carryover start
    expect(comparison.carryoverFinishTime).toEqual('11:00');
    expect(comparison.carryoverCount).toEqual(3);
    expect([comparison.startsHold, comparison.timedTargetCount]).toEqual([2, 4]);
    expect([comparison.beyondDayMatchUpIds, comparison.totalCount]).toEqual([['t4'], 7]);
    expect(comparison.unknownMinutesMatchUpIds).toEqual([]);
  });

  it('groups the table by imported start, the carryover first, each group in projected order', () => {
    const comparison = compareRecovery({ ...fixture(), scheduleDate: DAY });

    expect(comparison.groups.map((group) => [group.carryover, group.importedStart])).toEqual([
      [true, undefined],
      [false, '10:00'],
      [false, '13:00'],
    ]);
    const [carry, ten, one] = comparison.groups;
    expect(carry.rows.map((r) => [r.matchUpId, r.projectedTime])).toEqual([
      ['c1', '08:00'],
      ['c2', '08:00'],
      ['c3', '09:30'],
    ]);
    expect(ten.rows.map((r) => [r.matchUpId, r.holds])).toEqual([
      ['t1', true],
      ['t2', false],
    ]);
    // the unplaced one sorts last in its group and is marked beyond the day
    expect(one.rows.map((r) => [r.matchUpId, r.projectedTime, r.beyondDay])).toEqual([
      ['t3', '13:00', false],
      ['t4', undefined, true],
    ]);
  });

  it('never says a carryover holds, and reads an ISO imported start as its time', () => {
    const comparison = compareRecovery({
      result: run([
        ['c1', '10:00'],
        ['t1', '10:00'],
      ]),
      targetDay: [imported('t1', `${DAY}T10:00`)],
      averageMinutes: { c1: 60, t1: 60 },
      carryover: [carried('c1')],
      scheduleDate: DAY,
    });
    const rows = comparison.groups.flatMap((group) => group.rows);
    expect(rows.map((r) => [r.matchUpId, r.importedStart, r.holds])).toEqual([
      ['c1', undefined, false],
      ['t1', '10:00', true],
    ]);
  });

  it('flags a placed carryover with no minutes instead of silently ending it at its start', () => {
    const comparison = compareRecovery({
      result: run([
        ['c1', '08:00'],
        ['c2', '09:00'],
      ]),
      carryover: [carried('c1'), carried('c2')],
      averageMinutes: { c1: 90 },
      scheduleDate: DAY,
      targetDay: [],
    });
    expect(comparison.carryoverFinishTime).toEqual('09:30');
    expect(comparison.unknownMinutesMatchUpIds).toEqual(['c2']);
  });

  it('has no finish when no carryover was placed, and counts an untimed target matchUp only in the total', () => {
    const comparison = compareRecovery({
      result: run([['t1', '09:00']], ['c1']),
      targetDay: [imported('t1')],
      carryover: [carried('c1')],
      averageMinutes: { c1: 90, t1: 90 },
      scheduleDate: DAY,
    });
    expect(comparison.carryoverFinishTime).toBeUndefined();
    expect([comparison.startsHold, comparison.timedTargetCount, comparison.totalCount]).toEqual([0, 0, 2]);
    expect(comparison.beyondDayMatchUpIds).toEqual(['c1']);
    expect(comparison.groups.at(-1)).toMatchObject({ carryover: false, rows: [{ matchUpId: 't1' }] });
    expect(comparison.groups.at(-1)?.importedStart).toBeUndefined();
  });
});
