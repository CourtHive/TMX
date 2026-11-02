import { competitionEngine, mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PERIOD_LENGTH,
  SCHEDULING_SETTINGS_EXTENSION_NAME,
  effectivePeriodLength,
  periodLengthChoices,
  periodLengthWriteMethod,
  readStoredPeriodLength,
  schedulerPeriodLength,
  withPeriodLength,
} from './schedulingPeriodLength';

const DATE = '2026-11-13';

/** one court, one draw of 8 whose first round is profiled on the date */
function seed() {
  const {
    tournamentRecord: { tournamentId },
    venueIds: [venueId],
    eventIds: [eventId],
    drawIds: [drawId],
  } = mocksEngine.generateTournamentRecord({
    drawProfiles: [{ drawSize: 8, matchUpFormat: 'SET3-S:6/TB7' }],
    venueProfiles: [{ courtsCount: 1, startTime: '08:00', endTime: '22:00' }],
    startDate: DATE,
    endDate: DATE,
    setState: true,
  });
  const { structures } = tournamentEngine.getDrawStructures({ drawId }) as any;
  const structureId = structures?.[0]?.structureId;
  const result: any = competitionEngine.addSchedulingProfileRound({
    round: { tournamentId, eventId, drawId, structureId, roundNumber: 1 },
    scheduleDate: DATE,
    venueId,
  });
  expect(result.success).toEqual(true);
}

const record = () => tournamentEngine.getTournament().tournamentRecord;

/** stores the period (when it changes anything) and runs the timed scheduler with it, as Apply Times does */
function applyTimes(periodLength: number) {
  const write = periodLengthWriteMethod(record(), periodLength);
  const params = withPeriodLength({ scheduleDates: [DATE] }, schedulerPeriodLength(record(), periodLength));
  const methods = [...(write ? [write] : []), { method: 'scheduleProfileRounds', params }];
  const result: any = competitionEngine.executionQueue(methods);
  expect(result.success).toEqual(true);
  const { matchUps } = tournamentEngine.allTournamentMatchUps({ matchUpFilters: { roundNumbers: [1] } });
  return (matchUps ?? [])
    .map((matchUp: any) => matchUp.schedule?.scheduledTime)
    .filter(Boolean)
    .map((scheduledTime: string) => scheduledTime.slice(-5))
    .sort();
}

const minutesFromOpening = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes - 8 * 60;
};

describe('the scheduling period length, through the real engine', () => {
  it('a new tournament has none stored and shows the default', () => {
    seed();
    expect(readStoredPeriodLength(record())).toBeUndefined();
    expect(effectivePeriodLength(record())).toEqual(DEFAULT_PERIOD_LENGTH);
    expect(periodLengthChoices(record())).toEqual([5, 10, 15, 20, 30, 60]);
  });

  it('the default chosen with nothing stored writes nothing and passes no parameter', () => {
    seed();
    expect(periodLengthWriteMethod(record(), DEFAULT_PERIOD_LENGTH)).toBeUndefined();
    expect(schedulerPeriodLength(record(), DEFAULT_PERIOD_LENGTH)).toBeUndefined();
    expect(withPeriodLength({ scheduleDates: [DATE] }, schedulerPeriodLength(record()))).toEqual({
      scheduleDates: [DATE],
    });
  });

  it('is stored on the tournament record through executionQueue and read back', () => {
    seed();
    const write = periodLengthWriteMethod(record(), 15);
    const result: any = tournamentEngine.executionQueue([write]);
    expect(result.success).toEqual(true);
    expect(readStoredPeriodLength(record())).toEqual(15);
    expect(effectivePeriodLength(record())).toEqual(15);
    expect(periodLengthWriteMethod(record(), 15)).toBeUndefined();
    // stored: passed on every later run, with no choice made
    expect(schedulerPeriodLength(record())).toEqual(15);
    expect(schedulerPeriodLength(record(), DEFAULT_PERIOD_LENGTH)).toEqual(30);
    // back to the default once one is stored is a real change, and is written
    expect(periodLengthWriteMethod(record(), DEFAULT_PERIOD_LENGTH)?.params.extension.value.periodLength).toEqual(30);
  });

  it('keeps the other keys of the extension when it writes', () => {
    seed();
    tournamentEngine.addTournamentExtension({
      extension: { name: SCHEDULING_SETTINGS_EXTENSION_NAME, value: { other: 'kept', periodLength: 20 } },
    });
    expect(periodLengthWriteMethod(record(), 60)?.params.extension.value).toEqual({ other: 'kept', periodLength: 60 });
  });

  it('offers a stored value outside the standard choices', () => {
    seed();
    tournamentEngine.addTournamentExtension({
      extension: { name: SCHEDULING_SETTINGS_EXTENSION_NAME, value: { periodLength: 45 } },
    });
    expect(periodLengthChoices(record())).toEqual([5, 10, 15, 20, 30, 45, 60]);
  });

  it('ignores a stored value that is not a positive whole number of minutes', () => {
    seed();
    tournamentEngine.addTournamentExtension({
      extension: { name: SCHEDULING_SETTINGS_EXTENSION_NAME, value: { periodLength: 'x' } },
    });
    expect(readStoredPeriodLength(record())).toBeUndefined();
    expect(withPeriodLength({ a: 1 }, 0)).toEqual({ a: 1 });
  });

  it('changing the period changes the start-time grid', () => {
    seed();
    const thirty = applyTimes(30);
    expect(thirty.length).toEqual(4);
    expect(thirty.every((time) => minutesFromOpening(time) % 30 === 0)).toEqual(true);

    seed();
    const sixty = applyTimes(60);
    expect(sixty.length).toEqual(4);
    expect(readStoredPeriodLength(record())).toEqual(60);
    expect(sixty.every((time) => minutesFromOpening(time) % 60 === 0)).toEqual(true);
    expect(sixty).not.toEqual(thirty);

    seed();
    const twenty = applyTimes(20);
    expect(twenty.every((time) => minutesFromOpening(time) % 20 === 0)).toEqual(true);
  });
});
