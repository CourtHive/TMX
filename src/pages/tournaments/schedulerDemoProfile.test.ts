import { buildSchedulerDemoProfile, schedulerDemoDates } from './schedulerDemoProfile';
import { tournamentEngine } from 'services/factory/engine';
import { mocksEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';

const DAY_ONE = '2026-10-18';
const DAY_TWO = '2026-10-19';
const DAY_THREE = '2026-10-20';

function generate() {
  const profile = buildSchedulerDemoProfile(new Date('2026-10-18T14:00:00Z'));
  let result: any = mocksEngine.generateTournamentRecord(profile as any);
  expect(result.error).toBeUndefined();
  tournamentEngine.setState(result.tournamentRecord);
  return result.tournamentRecord;
}

function onDay(day: string) {
  return (tournamentEngine.allTournamentMatchUps().matchUps ?? []).filter(
    (matchUp: any) => matchUp.schedule?.scheduledDate === day,
  );
}

describe('Scheduling Lab — separate schedulers, then their composition', () => {
  it('opens unscheduled, with three calendar days and four identifiable draws', () => {
    const record = generate();
    expect(record.localTimeZone).toBe('America/New_York');
    expect(record.startDate).toBe(DAY_ONE);
    expect(record.endDate).toBe(DAY_THREE);
    expect(record.events).toHaveLength(4);
    const matchUps = tournamentEngine.allTournamentMatchUps().matchUps ?? [];
    expect(matchUps.length).toBeGreaterThan(30);
    expect(matchUps.some((matchUp: any) => matchUp.schedule?.scheduledTime || matchUp.schedule?.courtId)).toBe(false);
  });

  it('Garman assigns times only to day one; Pro assigns grid positions without times only to day two', () => {
    generate();
    let result: any = tournamentEngine.scheduleProfileRounds({ scheduleDates: [DAY_ONE] });
    expect(result.error).toBeUndefined();
    const timed = onDay(DAY_ONE);
    expect(timed.length).toBeGreaterThan(0);
    expect(timed.every((matchUp: any) => !!matchUp.schedule.scheduledTime)).toBe(true);
    expect(timed.every((matchUp: any) => matchUp.drawId === 'scheduler-draw-garman')).toBe(true);
    expect(onDay(DAY_TWO)).toHaveLength(0);

    result = tournamentEngine.scheduleProfileGrid({ scheduleDates: [DAY_TWO] });
    expect(result.error).toBeUndefined();
    const grid = onDay(DAY_TWO);
    expect(grid.length).toBeGreaterThan(0);
    expect(grid.every((matchUp: any) => matchUp.schedule.courtId && matchUp.schedule.courtOrder)).toBe(true);
    expect(grid.some((matchUp: any) => matchUp.schedule.scheduledTime)).toBe(false);
    expect(grid.every((matchUp: any) => matchUp.drawId === 'scheduler-draw-pro')).toBe(true);
    expect(onDay(DAY_THREE)).toHaveLength(0);
  });

  it('Pro preserves every Garman time when both run on day three, across singles and doubles', () => {
    generate();
    let result: any = tournamentEngine.scheduleProfileRounds({ scheduleDates: [DAY_THREE] });
    expect(result.error).toBeUndefined();
    const before = new Map(onDay(DAY_THREE).map((matchUp: any) => [matchUp.matchUpId, matchUp.schedule.scheduledTime]));
    expect(before.size).toBeGreaterThan(0);
    result = tournamentEngine.scheduleProfileGrid({ scheduleDates: [DAY_THREE] });
    expect(result.error).toBeUndefined();
    const after = onDay(DAY_THREE);
    expect(new Set(after.map((matchUp: any) => matchUp.matchUpType))).toEqual(new Set(['SINGLES', 'DOUBLES']));
    for (const matchUp of after) {
      expect(matchUp.schedule?.courtId).toBeTruthy();
      expect(matchUp.schedule?.courtOrder).toBeGreaterThan(0);
      expect(matchUp.schedule?.scheduledTime).toBe(before.get(matchUp.matchUpId));
    }
    expect(after).toHaveLength(before.size);
    expect(onDay(DAY_ONE)).toHaveLength(0);
    expect(onDay(DAY_TWO)).toHaveLength(0);
  });

  it('uses venue dates even when the browser UTC date differs, including DST and month boundaries', () => {
    expect(buildSchedulerDemoProfile(new Date('2026-10-19T02:00Z'))?.startDate).toBe(DAY_ONE);
    expect(schedulerDemoDates('2026-10-31')).toEqual(['2026-10-31', '2026-11-01', '2026-11-02']);
    expect(buildSchedulerDemoProfile(new Date(Number.NaN))).toBeUndefined();
  });
});
