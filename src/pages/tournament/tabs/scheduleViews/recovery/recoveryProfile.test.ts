import { mocksEngine, scheduleGovernor, tools, tournamentEngine } from 'tods-competition-factory';
import { buildRecoveryProfile, importedStart } from './recoveryProfile';
import { describe, expect, it } from 'vitest';

const INTERRUPTED = '2026-11-21';
const TARGET = '2026-11-22';

/** a 16-draw at one venue: round 1 left on the interrupted day, round 2 imported onto the target day */
function setup() {
  const {
    drawIds: [drawId],
    venueIds: [venueId],
  } = mocksEngine.generateTournamentRecord({
    venueProfiles: [{ courtsCount: 4, startTime: '08:00', endTime: '20:00' }],
    drawProfiles: [{ drawSize: 16 }],
    startDate: INTERRUPTED,
    endDate: '2026-11-23',
    setState: true,
  });
  const matchUps = tournamentEngine.allTournamentMatchUps({ inContext: true }).matchUps ?? [];
  const round = (roundNumber: number) =>
    matchUps
      .filter((matchUp: any) => matchUp.roundNumber === roundNumber)
      .toSorted((a: any, b: any) => a.roundPosition - b.roundPosition);
  const withSchedule = (matchUp: any, schedule: any) => ({ ...matchUp, schedule });
  return { drawId, venueId, round, withSchedule };
}

const ids = (matchUps: any[]) => matchUps.map(({ matchUpId }) => matchUpId);

describe('buildRecoveryProfile', () => {
  it('offers the carryover first, by round, with no notBeforeTime', () => {
    const { venueId, round, withSchedule } = setup();
    const carryover = round(1).map((matchUp: any) => withSchedule(matchUp, { venueId, scheduledTime: '16:30' }));

    const { schedulingProfile, unvenuedMatchUpIds } = buildRecoveryProfile({
      releasePolicy: 'ready',
      scheduleDate: TARGET,
      targetDay: [],
      carryover,
    });

    expect(unvenuedMatchUpIds).toEqual([]);
    const [{ scheduleDate, venues }] = schedulingProfile;
    expect(scheduleDate).toEqual(TARGET);
    expect(venues.map((venue) => venue.venueId)).toEqual([venueId]);
    const [carried] = venues[0].rounds;
    expect(venues[0].rounds.length).toEqual(1);
    expect(carried.roundNumber).toEqual(1);
    expect(carried.matchUpIds).toEqual(ids(round(1)));
    // the interrupted day's 16:30 is not carried over as a start the next day
    expect(carried.notBeforeTime).toBeUndefined();
  });

  it('holds the target day to its imported starts, grouped by round and start, earliest first', () => {
    const { venueId, round, withSchedule } = setup();
    const [a, b, c, d] = round(2);
    const targetDay = [
      withSchedule(c, { venueId, scheduledTime: `${TARGET}T13:00` }),
      withSchedule(a, { venueId, scheduledTime: '10:00' }),
      withSchedule(d, { venueId, scheduledTime: '13:00' }),
      withSchedule(b, { venueId, scheduledTime: '10:00' }),
    ];

    const { schedulingProfile } = buildRecoveryProfile({
      carryover: round(1).map((matchUp: any) => withSchedule(matchUp, { venueId })),
      releasePolicy: 'ready',
      scheduleDate: TARGET,
      targetDay,
    });

    const [carried, tenAM, onePM] = schedulingProfile[0].venues[0].rounds;
    expect(carried.notBeforeTime).toBeUndefined();
    expect(tenAM).toMatchObject({ roundNumber: 2, notBeforeTime: '10:00', matchUpIds: ids([a, b]) });
    // an ISO imported time and an HH:MM one name the same start
    expect(onePM).toMatchObject({ roundNumber: 2, notBeforeTime: '13:00', matchUpIds: ids([c, d]) });
  });

  it('under the finish policy raises a start to the carryover finish, and leaves a later start alone', () => {
    const { venueId, round, withSchedule } = setup();
    const [a, b] = round(2);
    const targetDay = [
      withSchedule(a, { venueId, scheduledTime: '10:00' }),
      withSchedule(b, { venueId, scheduledTime: '15:00' }),
    ];
    const build = (releasePolicy: 'ready' | 'finish') =>
      buildRecoveryProfile({
        carryoverFinishTime: '12:30',
        scheduleDate: TARGET,
        carryover: [],
        releasePolicy,
        targetDay,
      }).schedulingProfile[0].venues[0].rounds.map((profileRound) => profileRound.notBeforeTime);

    expect(build('ready')).toEqual(['10:00', '15:00']);
    expect(build('finish')).toEqual(['12:30', '15:00']);
  });

  it('offers a target-day matchUp with no imported start last, unheld', () => {
    const { venueId, round, withSchedule } = setup();
    const [a, b] = round(2);
    const { schedulingProfile } = buildRecoveryProfile({
      targetDay: [withSchedule(a, { venueId }), withSchedule(b, { venueId, scheduledTime: '11:00' })],
      releasePolicy: 'ready',
      scheduleDate: TARGET,
      carryover: [],
    });

    const rounds = schedulingProfile[0].venues[0].rounds;
    expect(rounds.map((profileRound) => [profileRound.matchUpIds, profileRound.notBeforeTime])).toEqual([
      [[b.matchUpId], '11:00'],
      [[a.matchUpId], undefined],
    ]);
  });

  it('places a matchUp with no venue at the default, and reports it when there is none', () => {
    const { venueId, round, withSchedule } = setup();
    const [a] = round(1);
    const carryover = [withSchedule(a, {})];

    let result = buildRecoveryProfile({
      carryover,
      defaultVenueId: venueId,
      releasePolicy: 'ready',
      scheduleDate: TARGET,
      targetDay: [],
    });
    expect(result.unvenuedMatchUpIds).toEqual([]);
    expect(result.schedulingProfile[0].venues[0].venueId).toEqual(venueId);

    result = buildRecoveryProfile({ carryover, releasePolicy: 'ready', scheduleDate: TARGET, targetDay: [] });
    expect(result.unvenuedMatchUpIds).toEqual([a.matchUpId]);
    expect(result.schedulingProfile[0].venues).toEqual([]);
  });

  it('builds a profile the factory accepts, on a copy that leaves the live record alone', () => {
    const { venueId, round, withSchedule } = setup();
    const { schedulingProfile } = buildRecoveryProfile({
      carryover: round(1).map((matchUp: any) => withSchedule(matchUp, { venueId })),
      targetDay: round(2).map((matchUp: any) => withSchedule(matchUp, { venueId, scheduledTime: '11:00' })),
      releasePolicy: 'ready',
      scheduleDate: TARGET,
    });

    const before = JSON.stringify(tournamentEngine.getState().tournamentRecords);
    const workingCopy = tools.makeDeepCopy(tournamentEngine.getState().tournamentRecords, false, true);
    const result: any = scheduleGovernor.setSchedulingProfile({ tournamentRecords: workingCopy, schedulingProfile });
    expect(result.success).toEqual(true);
    expect(JSON.stringify(tournamentEngine.getState().tournamentRecords)).toEqual(before);
  });
});

describe('importedStart', () => {
  it('reads HH:MM from an ISO or HH:MM scheduledTime, and nothing from none', () => {
    const matchUp = (scheduledTime?: string): any => ({ schedule: { scheduledTime } });
    expect(importedStart(matchUp(`${TARGET}T09:30`))).toEqual('09:30');
    expect(importedStart(matchUp('09:30'))).toEqual('09:30');
    expect(importedStart(matchUp())).toBeUndefined();
  });
});
