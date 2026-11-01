/**
 * A dual's team score set by hand, its restore, and a decided dual's unplayed lines, through the real engine: the
 * methods the scorecard sends are run as the executionQueue runs them.
 */
import { eventConstants, matchUpStatusConstants, mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { deadRubberMethods, overrideTeamScoreMethod, restoreAutoCalcMethod } from './dualOverride';
import { describe, expect, it } from 'vitest';

const { TEAM } = eventConstants;
const { DEAD_RUBBER, TO_BE_PLAYED } = matchUpStatusConstants;

function dual(): any {
  return tournamentEngine
    .allTournamentMatchUps({ inContext: true })
    .matchUps?.find((m: any) => m.matchUpType === TEAM && m.tieMatchUps?.length);
}

// a completed dual has its line-ups; clearing every line leaves lines that can be scored, with players assigned
function unscoredDual() {
  mocksEngine.generateTournamentRecord({
    drawProfiles: [{ drawSize: 2, eventType: TEAM }],
    completeAllMatchUps: true,
    setState: true,
  });
  const { drawId, tieMatchUps } = dual();
  const outcome = { matchUpStatus: TO_BE_PLAYED, score: { sets: [] }, winningSide: undefined };
  for (const { matchUpId } of tieMatchUps) {
    const result: any = tournamentEngine.setMatchUpStatus({ drawId, matchUpId, outcome });
    expect(result.success).toEqual(true);
  }
  return dual();
}

const run = (methods: any[]) => tournamentEngine.executionQueue(methods, true);

function winLine(drawId: string, matchUpId: string) {
  const { outcome } = mocksEngine.generateOutcomeFromScoreString({ scoreString: '6-1 6-1', winningSide: 1 });
  const result: any = tournamentEngine.setMatchUpStatus({ drawId, matchUpId, outcome });
  expect(result.success).toEqual(true);
}

describe('dual override', () => {
  it('a team score set by hand holds while lines are scored, and restore recalculates from the lines', () => {
    const { drawId, matchUpId, tieMatchUps } = unscoredDual();
    const [first, second] = tieMatchUps.map(({ matchUpId }) => matchUpId);
    winLine(drawId, first);
    expect(dual().score.sets[0]).toMatchObject({ side1Score: 1, side2Score: 0 });

    let result: any = run([
      overrideTeamScoreMethod({ drawId, matchUpId, teamScore: { side1Score: 0, side2Score: 3, winningSide: 2 } }),
    ]);
    expect(result.success).toEqual(true);
    expect(dual().winningSide).toEqual(2);
    expect(dual().score.sets[0]).toMatchObject({ side1Score: 0, side2Score: 3 });
    expect(dual().score.scoreStringSide1).toEqual('0-3');

    // a line scored later does not change the held score
    winLine(drawId, second);
    expect(dual().score.sets[0]).toMatchObject({ side1Score: 0, side2Score: 3 });
    expect(dual().winningSide).toEqual(2);

    result = run([restoreAutoCalcMethod({ drawId, matchUpId })]);
    expect(result.success).toEqual(true);
    expect(dual().score.sets[0]).toMatchObject({ side1Score: 2, side2Score: 0 });
    expect(dual().winningSide).toBeUndefined();
  });

  it("a decided dual's unplayed lines are recorded as dead rubbers", () => {
    const { drawId, tieMatchUps } = unscoredDual();
    const unplayed = tieMatchUps.slice(-2).map(({ matchUpId }) => matchUpId);
    const result: any = run(deadRubberMethods({ drawId, matchUpIds: unplayed }));
    expect(result.success).toEqual(true);
    const statuses = dual()
      .tieMatchUps.filter(({ matchUpId }) => unplayed.includes(matchUpId))
      .map(({ matchUpStatus }) => matchUpStatus);
    expect(statuses).toEqual([DEAD_RUBBER, DEAD_RUBBER]);
    expect(deadRubberMethods({ drawId })).toEqual([]);
  });
});
