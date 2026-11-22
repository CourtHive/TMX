import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { analyzeCarryover, isConcluded } from './carryoverAnalysis';
import { describe, expect, it } from 'vitest';

const START = '2026-11-20';
const YESTERDAY = '2026-11-21';
const TODAY = '2026-11-22';
const END = '2026-11-24';

/** an 8-draw; `outcomes` resolve first-round matchUps by round position */
function setup(outcomes: any[] = []) {
  const {
    drawIds: [drawId],
  } = mocksEngine.generateTournamentRecord({
    drawProfiles: [{ drawSize: 8, outcomes }],
    startDate: START,
    endDate: END,
    setState: true,
  });
  const matchUp = (roundNumber: number, roundPosition: number): any =>
    tournamentEngine
      .allTournamentMatchUps({ inContext: true })
      .matchUps?.find((m: any) => m.roundNumber === roundNumber && m.roundPosition === roundPosition);
  const schedule = (target: any, scheduledDate: string, scheduledTime?: string): any =>
    tournamentEngine.addMatchUpScheduleItems({
      schedule: { scheduledDate, ...(scheduledTime ? { scheduledTime } : {}) },
      matchUpId: target.matchUpId,
      drawId,
    });
  const analyze = () => {
    const { matchUps } = tournamentEngine.allTournamentMatchUps({ inContext: true });
    const { matchUpDependencies } = tournamentEngine.getMatchUpDependencies({ matchUps });
    return analyzeCarryover({ matchUps, matchUpDependencies, today: TODAY });
  };
  const bounds = (target: any): any =>
    tournamentEngine.getMatchUpScheduleBounds({ drawId, matchUpId: target.matchUpId }).bounds;
  return { drawId, matchUp, schedule, analyze, bounds };
}

describe('analyzeCarryover', () => {
  it('flags a past-dated unresulted matchUp as blocking while a matchUp feeding it has no result', () => {
    const { matchUp, schedule, analyze, bounds } = setup();
    const semi = matchUp(2, 1);
    expect(schedule(semi, YESTERDAY, '14:30').success).toEqual(true);

    const { carryover, blocking, heldBackMatchUpIds } = analyze();
    expect(carryover.map((item) => item.matchUpId)).toEqual([semi.matchUpId]);
    expect(blocking.map((item) => item.matchUpId)).toEqual([semi.matchUpId]);
    expect(heldBackMatchUpIds.sort()).toEqual([matchUp(1, 1).matchUpId, matchUp(1, 2).matchUpId].sort());

    // the premise the warning rests on: the factory gives the feeder no day after the carryover's
    expect(bounds(matchUp(1, 1)).latestDate).toEqual(YESTERDAY);
  });

  it('frees the feeders once the carryover loses its date', () => {
    const { matchUp, schedule, analyze, bounds } = setup();
    const semi = matchUp(2, 1);
    schedule(semi, YESTERDAY, '14:30');
    const feeder = matchUp(1, 1);
    expect(schedule(feeder, TODAY, '09:00').error).toBeDefined();

    const result: any = tournamentEngine.bulkScheduleMatchUps({
      schedule: { courtId: '', venueId: '', courtOrder: '', scheduledDate: '', scheduledTime: '' },
      matchUpIds: [semi.matchUpId],
      removePriorValues: true,
    });
    expect(result.success).toEqual(true);

    expect(analyze().blocking).toEqual([]);
    expect(bounds(feeder).latestDate).toEqual(END);
    expect(schedule(feeder, TODAY, '09:00').success).toEqual(true);
  });

  it('lists a carryover whose feeders are all decided without calling it blocking', () => {
    const { matchUp, schedule, analyze } = setup([
      { roundNumber: 1, roundPosition: 1, scoreString: '6-1 6-1', winningSide: 1 },
      { roundNumber: 1, roundPosition: 2, scoreString: '6-2 6-2', winningSide: 2 },
    ]);
    const semi = matchUp(2, 1);
    schedule(semi, YESTERDAY, '14:30');

    const { carryover, blocking } = analyze();
    expect(carryover.map((item) => item.matchUpId)).toEqual([semi.matchUpId]);
    expect(carryover[0].heldBackMatchUpIds).toEqual([]);
    expect(blocking).toEqual([]);
  });

  it('ignores a resulted matchUp from an earlier day and anything dated today', () => {
    const { matchUp, schedule, analyze } = setup([
      { roundNumber: 1, roundPosition: 1, scoreString: '6-1 6-1', winningSide: 1 },
    ]);
    schedule(matchUp(1, 1), YESTERDAY, '09:00');
    schedule(matchUp(1, 2), TODAY, '09:00');
    schedule(matchUp(2, 1), TODAY, '14:00');

    expect(analyze().carryover).toEqual([]);
  });

  it('marks a carryover already under way, so the modal does not select it for clearing', () => {
    const { drawId, matchUp, schedule, analyze } = setup();
    const first = matchUp(1, 3);
    schedule(first, YESTERDAY, '09:00');
    const started: any = tournamentEngine.setMatchUpStatus({
      outcome: { matchUpStatus: 'IN_PROGRESS' },
      matchUpId: first.matchUpId,
      drawId,
    });
    expect(started.success).toEqual(true);

    const [item] = analyze().carryover;
    expect(item.matchUpId).toEqual(first.matchUpId);
    expect(item.underWay).toEqual(true);
  });

  it('orders the carryover by day, then time', () => {
    const { matchUp, schedule, analyze } = setup();
    schedule(matchUp(1, 2), YESTERDAY, '11:00');
    schedule(matchUp(1, 1), YESTERDAY, '09:00');
    schedule(matchUp(1, 3), START);

    expect(analyze().carryover.map((item) => item.scheduledDate + (item.scheduledTime ?? ''))).toEqual([
      START,
      `${YESTERDAY}09:00`,
      `${YESTERDAY}11:00`,
    ]);
  });
});

describe('isConcluded', () => {
  it('treats a winner, a completed status and a BYE as decided', () => {
    expect(isConcluded({ winningSide: 1 })).toEqual(true);
    expect(isConcluded({ matchUpStatus: 'WALKOVER' })).toEqual(true);
    expect(isConcluded({ matchUpStatus: 'BYE' })).toEqual(true);
    expect(isConcluded({ matchUpStatus: 'TO_BE_PLAYED' })).toEqual(false);
    expect(isConcluded({ matchUpStatus: 'IN_PROGRESS' })).toEqual(false);
  });
});
