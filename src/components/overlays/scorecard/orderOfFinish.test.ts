/**
 * Order of finish for a dual's lines, through the real engine: a line completed from the scorecard takes the next
 * number in its cohort, a score edit keeps it, and the modal's order replaces a cohort's numbers.
 */
import { eventConstants, matchUpStatusConstants, mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';
import {
  completedLineOrderMethod,
  finishingOrderMethods,
  isValidFinishingOrder,
  orderOfFinishCohorts,
} from './orderOfFinish';

const { TEAM } = eventConstants;
const { TO_BE_PLAYED } = matchUpStatusConstants;
const clearedOutcome = { matchUpStatus: TO_BE_PLAYED, score: { sets: [] }, winningSide: undefined };

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
  for (const { matchUpId } of tieMatchUps) {
    const result: any = tournamentEngine.setMatchUpStatus({ drawId, matchUpId, outcome: clearedOutcome });
    expect(result.success).toEqual(true);
  }
  expect(dual().tieMatchUps.every((m: any) => m.matchUpStatus === TO_BE_PLAYED)).toEqual(true);
  return dual();
}

const lines = (matchUpType: string) => dual().tieMatchUps.filter((m: any) => m.matchUpType === matchUpType);
const orderOf = (matchUpId: string) => dual().tieMatchUps.find((m: any) => m.matchUpId === matchUpId)?.orderOfFinish;

/** Score a line the way the scorecard does, then send the numbering it would send. */
function completeFromScorecard(matchUpId: string, scoreString = '6-1 6-1') {
  const before = dual();
  const wasCompleted = before.tieMatchUps.find((m: any) => m.matchUpId === matchUpId).matchUpStatus === 'COMPLETED';
  const { outcome } = mocksEngine.generateOutcomeFromScoreString({ scoreString, winningSide: 1 });
  let result: any = tournamentEngine.setMatchUpStatus({ drawId: before.drawId, matchUpId, outcome });
  expect(result.success).toEqual(true);

  const method = completedLineOrderMethod({ dual: dual(), matchUpId, wasCompleted });
  if (method) {
    result = tournamentEngine.executionQueue([method], true);
    expect(result.success).toEqual(true);
  }
  return method;
}

describe('order of finish', () => {
  it('numbers each line as it completes, per matchUpType', () => {
    unscoredDual();
    const [s1, s2, s3] = lines('SINGLES');
    const [d1] = lines('DOUBLES');

    completeFromScorecard(s3.matchUpId);
    completeFromScorecard(d1.matchUpId);
    completeFromScorecard(s1.matchUpId);
    completeFromScorecard(s2.matchUpId);

    expect([orderOf(s3.matchUpId), orderOf(s1.matchUpId), orderOf(s2.matchUpId)]).toEqual([1, 2, 3]);
    expect(orderOf(d1.matchUpId)).toEqual(1);
    expect(
      orderOfFinishCohorts(dual())
        .find(({ matchUpType }) => matchUpType === 'SINGLES')
        ?.matchUps.map((m) => m.matchUpId),
    ).toEqual([s3.matchUpId, s1.matchUpId, s2.matchUpId]);
  });

  it('keeps the number when a completed line is re-scored', () => {
    unscoredDual();
    const [s1, s2] = lines('SINGLES');
    completeFromScorecard(s1.matchUpId);
    completeFromScorecard(s2.matchUpId);

    expect(completeFromScorecard(s1.matchUpId, '6-2 6-2')).toBeUndefined();
    expect([orderOf(s1.matchUpId), orderOf(s2.matchUpId)]).toEqual([1, 2]);
  });

  it('puts a line completed again after its score was cleared at the end, and closes the gap', () => {
    unscoredDual();
    const [s1, s2, s3] = lines('SINGLES');
    completeFromScorecard(s1.matchUpId);
    completeFromScorecard(s2.matchUpId);

    // the factory removes a cleared line's number (factory #6030); only completed lines count
    const result: any = tournamentEngine.setMatchUpStatus({
      drawId: dual().drawId,
      matchUpId: s1.matchUpId,
      outcome: clearedOutcome,
    });
    expect(result.success).toEqual(true);
    expect(orderOf(s1.matchUpId)).toBeUndefined();
    expect(orderOfFinishCohorts(dual()).find(({ matchUpType }) => matchUpType === 'SINGLES')?.matchUps.length).toEqual(
      1,
    );

    completeFromScorecard(s3.matchUpId);
    completeFromScorecard(s1.matchUpId);
    // the cohort is renumbered 1..n in order, closing the gap the cleared line left
    expect([orderOf(s2.matchUpId), orderOf(s3.matchUpId), orderOf(s1.matchUpId)]).toEqual([1, 2, 3]);
  });

  it('sends nothing for a line that is not complete', () => {
    const { drawId, tieMatchUps } = unscoredDual();
    expect(
      completedLineOrderMethod({
        dual: { drawId, tieMatchUps },
        matchUpId: tieMatchUps[0].matchUpId,
        wasCompleted: false,
      }),
    ).toBeUndefined();
  });

  it("the modal's order replaces a cohort's numbers", () => {
    unscoredDual();
    const [s1, s2, s3] = lines('SINGLES');
    for (const { matchUpId } of [s1, s2, s3]) completeFromScorecard(matchUpId);

    const methods = finishingOrderMethods({
      drawId: dual().drawId,
      orderedCohorts: [[s2.matchUpId, s3.matchUpId, s1.matchUpId], []],
    });
    expect(methods).toHaveLength(1);
    const result: any = tournamentEngine.executionQueue(methods, true);
    expect(result.success).toEqual(true);
    expect([orderOf(s2.matchUpId), orderOf(s3.matchUpId), orderOf(s1.matchUpId)]).toEqual([1, 2, 3]);
  });

  it('accepts only numbers that run 1..n, each once', () => {
    expect(isValidFinishingOrder([2, 1, 3])).toEqual(true);
    expect(isValidFinishingOrder([1, 1, 3])).toEqual(false);
    expect(isValidFinishingOrder([1, 3])).toEqual(false);
    expect(isValidFinishingOrder([])).toEqual(true);
  });
});
