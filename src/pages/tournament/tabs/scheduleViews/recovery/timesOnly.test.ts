import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { placementsHoldCourts, timesOnlyPlacements } from './timesOnly';
import { describe, expect, it } from 'vitest';

const DAY = '2026-11-22';
const INTERRUPTED = '2026-11-21';

describe('timesOnlyPlacements', () => {
  it('keeps date, time and venue, and clears the court and order', () => {
    const [placement] = timesOnlyPlacements([
      {
        tournamentId: 't',
        matchUpId: 'm',
        schedule: { scheduledDate: DAY, scheduledTime: '10:30', venueId: 'v', courtId: 'c1', courtOrder: 3 },
      },
    ]);
    expect(placement.schedule).toEqual({
      scheduledDate: DAY,
      scheduledTime: '10:30',
      venueId: 'v',
      courtId: '',
      courtOrder: '',
    });
  });

  it('keeps a placement that pulls a matchUp off the grid, and one with no time, as they are', () => {
    const pulled = { tournamentId: 't', matchUpId: 'a', schedule: {} };
    const dateOnly = { tournamentId: 't', matchUpId: 'b', schedule: { scheduledDate: DAY, courtId: 'c1' } };
    expect(timesOnlyPlacements([pulled, dateOnly])).toEqual([pulled, dateOnly]);
  });

  it('says whether a plan still assigns a court', () => {
    const timed = { tournamentId: 't', matchUpId: 'a', schedule: { scheduledDate: DAY, scheduledTime: '09:00' } };
    const courted = { ...timed, schedule: { ...timed.schedule, courtId: 'c1' } };
    expect(placementsHoldCourts([timed])).toEqual(false);
    expect(placementsHoldCourts([timed, courted])).toEqual(true);
    expect(placementsHoldCourts(timesOnlyPlacements([courted]))).toEqual(false);
  });

  it("committed, moves a carryover to the new day and drops the interrupted day's court", () => {
    const {
      drawIds: [drawId],
      venueIds: [venueId],
    } = mocksEngine.generateTournamentRecord({
      venueProfiles: [{ courtsCount: 2, startTime: '08:00', endTime: '20:00' }],
      drawProfiles: [{ drawSize: 4 }],
      startDate: INTERRUPTED,
      endDate: DAY,
      setState: true,
    });
    const { tournamentId } = tournamentEngine.getTournament().tournamentRecord;
    const courts: any[] = tournamentEngine.getVenuesAndCourts().courts ?? [];
    const roundOne: any[] =
      tournamentEngine.allTournamentMatchUps({ matchUpFilters: { roundNumbers: [1] } }).matchUps ?? [];
    const [matchUp] = roundOne;
    const { matchUpId } = matchUp;
    // the interrupted day: on court 1, never played
    let result: any = tournamentEngine.addMatchUpScheduleItems({
      schedule: {
        scheduledDate: INTERRUPTED,
        scheduledTime: '16:30',
        venueId,
        courtId: courts[0].courtId,
        courtOrder: 1,
      },
      matchUpId,
      drawId,
    });
    expect(result.success).toEqual(true);

    // a plan placed it on a court the next day; saved times only, then made official
    const planned = {
      tournamentId,
      matchUpId,
      schedule: { scheduledDate: DAY, scheduledTime: '09:00', venueId, courtId: courts[1].courtId, courtOrder: 1 },
    };
    result = tournamentEngine.addScheduleScenario({
      scenario: { scenarioName: 'Recovery', placements: timesOnlyPlacements([planned]) },
    });
    expect(result.success).toEqual(true);
    result = tournamentEngine.applyScheduleScenario({ scenarioId: result.scenarioId ?? result.scenario?.scenarioId });
    expect(result.success).toEqual(true);

    const found: any = tournamentEngine.findMatchUp({ matchUpId, inContext: true });
    const { schedule } = found.matchUp;
    expect(schedule.scheduledDate).toEqual(DAY);
    expect(schedule.scheduledTime).toEqual('09:00');
    expect(schedule.courtId).toBeUndefined();
  });
});
