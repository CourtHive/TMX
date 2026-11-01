/**
 * Order of finish for a dual's lines, through the real engine: the factory numbers each line as it finishes, per
 * collection; the scorecard offers a collection for correction once two of its lines are numbered, and the order the
 * collection card hands back replaces the collection's numbers.
 */
import { finishingOrderCollections, finishingOrderMethod } from './orderOfFinish';
import { eventConstants, matchUpStatusConstants, mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';

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
  expect(dual().tieMatchUps.every((m: any) => m.orderOfFinish === undefined)).toEqual(true);
  return dual();
}

const lines = (matchUpType: string) => dual().tieMatchUps.filter((m: any) => m.matchUpType === matchUpType);
const orderOf = (matchUpId: string) => dual().tieMatchUps.find((m: any) => m.matchUpId === matchUpId)?.orderOfFinish;

function score(matchUpId: string) {
  const { outcome } = mocksEngine.generateOutcomeFromScoreString({ scoreString: '6-1 6-1', winningSide: 1 });
  const result: any = tournamentEngine.setMatchUpStatus({ drawId: dual().drawId, matchUpId, outcome });
  expect(result.success).toEqual(true);
}

describe('order of finish', () => {
  it('is numbered by the factory as each line finishes, per collection', () => {
    unscoredDual();
    const [s1, s2, s3] = lines('SINGLES');
    const [d1] = lines('DOUBLES');
    for (const { matchUpId } of [s3, d1, s1, s2]) score(matchUpId);

    expect([orderOf(s3.matchUpId), orderOf(s1.matchUpId), orderOf(s2.matchUpId)]).toEqual([1, 2, 3]);
    expect(orderOf(d1.matchUpId)).toEqual(1);
  });

  it('offers a collection for correction once two of its lines are numbered', () => {
    unscoredDual();
    const [s1, s2] = lines('SINGLES');
    const [d1] = lines('DOUBLES');
    expect(finishingOrderCollections(dual())).toEqual([]);

    score(s1.matchUpId);
    score(d1.matchUpId);
    expect(finishingOrderCollections(dual())).toEqual([]);

    score(s2.matchUpId);
    const offered = finishingOrderCollections(dual());
    expect(offered.map(({ collectionId }) => collectionId)).toEqual([s1.collectionId]);
    expect(offered[0].collectionName).toBeTruthy();
  });

  it("the card's order replaces the collection's numbers", () => {
    unscoredDual();
    const [s1, s2, s3] = lines('SINGLES');
    for (const { matchUpId } of [s1, s2, s3]) score(matchUpId);

    const finishingOrder = [s2, s3, s1].map(({ matchUpId }, index) => ({ matchUpId, orderOfFinish: index + 1 }));
    const result: any = tournamentEngine.executionQueue([
      finishingOrderMethod({ drawId: dual().drawId, finishingOrder }),
    ]);
    expect(result.success).toEqual(true);
    expect([orderOf(s2.matchUpId), orderOf(s3.matchUpId), orderOf(s1.matchUpId)]).toEqual([1, 2, 3]);
  });
});
