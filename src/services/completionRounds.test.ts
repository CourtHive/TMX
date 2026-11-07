import { completionRounds, roundsToCompleteThrough, throughRoundSpan } from './completionRounds';
import {
  drawDefinitionConstants,
  matchUpStatusConstants,
  mocksEngine,
  tournamentEngine,
} from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';

const { ROUND_ROBIN } = drawDefinitionConstants;
const { DOUBLE_WALKOVER } = matchUpStatusConstants;

/**
 * "Complete through a round" (CA 2026-11-08): the control reads a structure's rounds and asks the factory for
 * `roundsToComplete`, which the factory counts from the structure's first round still to play. These run the real
 * completion with the helper's count, so a disagreement between the two readings of "still to play" fails here.
 */
function seed(drawProfile: any) {
  const {
    drawIds: [drawId],
  } = mocksEngine.generateTournamentRecord({ drawProfiles: [drawProfile], setState: true });
  const structureId = tournamentEngine.getEvent({ drawId }).drawDefinition.structures[0].structureId;
  return { drawId, structureId };
}

function structureMatchUps(drawId: string, structureId: string) {
  return (tournamentEngine.allDrawMatchUps({ drawId, inContext: true }).matchUps ?? []).filter(
    (m: any) => m.structureId === structureId || m.containerStructureId === structureId,
  );
}

function completeThrough(drawId: string, structureId: string, targetRound: number) {
  const completion = completionRounds(structureMatchUps(drawId, structureId));
  const roundsToComplete = roundsToCompleteThrough(completion, targetRound);
  let result: any = tournamentEngine.completeDrawMatchUps({ drawId, structureIds: [structureId], roundsToComplete });
  expect(result.success).toBe(true);
  return completionRounds(structureMatchUps(drawId, structureId));
}

const openByRound = (completion: any) => completion.rounds.map((round: any) => round.openCount);

describe('completionRounds', () => {
  it('names an elimination structure’s rounds and counts what is still to play', () => {
    const { drawId, structureId } = seed({ drawSize: 16 });
    const completion = completionRounds(structureMatchUps(drawId, structureId));
    expect(completion.rounds.map((round) => round.label)).toEqual(['R16', 'QF', 'SF', 'F']);
    expect(openByRound(completion)).toEqual([8, 4, 2, 1]);
    expect(completion).toMatchObject({ firstOpenRound: 1, openCount: 15 });
  });

  it('through the quarterfinal from the start completes two rounds and stops', () => {
    const { drawId, structureId } = seed({ drawSize: 16 });
    const after = completeThrough(drawId, structureId, 2);
    expect(openByRound(after)).toEqual([0, 0, 2, 1]);
    expect(after.firstOpenRound).toEqual(3);
  });

  it('counts from the first round still to play: R1 done, through SF is two more rounds', () => {
    const { drawId, structureId } = seed({ drawSize: 16 });
    completeThrough(drawId, structureId, 1);
    const before = completionRounds(structureMatchUps(drawId, structureId));
    expect(roundsToCompleteThrough(before, 3)).toEqual(2);
    expect(throughRoundSpan(before, 3).map((round) => round.label)).toEqual(['QF', 'SF']);

    const after = completeThrough(drawId, structureId, 3);
    expect(openByRound(after)).toEqual([0, 0, 0, 1]);
  });

  it('BYEs are not still to play: a 12 in a 16 opens in round 1 with four matchUps', () => {
    const { drawId, structureId } = seed({ drawSize: 16, participantsCount: 12 });
    const completion = completionRounds(structureMatchUps(drawId, structureId));
    expect(completion.rounds[0]).toMatchObject({ matchUpsCount: 8, openCount: 4 });
    const after = completeThrough(drawId, structureId, 1);
    expect(openByRound(after)).toEqual([0, 4, 2, 1]);
  });

  it('a DOUBLE_WALKOVER left in round 1 is settled: through SF stops before the final', () => {
    // read as still to play, round 1 would be the first open round and the count one too many: the final completed
    const { drawId, structureId } = seed({ drawSize: 8 });
    const [first] = structureMatchUps(drawId, structureId).filter((m: any) => m.roundNumber === 1);
    let result: any = tournamentEngine.setMatchUpStatus({
      outcome: { matchUpStatus: DOUBLE_WALKOVER },
      matchUpId: first.matchUpId,
      drawId,
    });
    expect(result.success).toBe(true);
    result = tournamentEngine.completeDrawMatchUps({ drawId, structureIds: [structureId], roundNumber: 1 });
    expect(result.success).toBe(true);

    const before = completionRounds(structureMatchUps(drawId, structureId));
    expect(before.firstOpenRound).toEqual(2);
    const after = completeThrough(drawId, structureId, 2);
    expect(after.rounds.at(-1)?.openCount).toEqual(1);
  });

  it('a round robin: through round 2 in every group', () => {
    const { drawId, structureId } = seed({ drawSize: 8, drawType: ROUND_ROBIN, structureOptions: { groupSize: 4 } });
    const completion = completionRounds(structureMatchUps(drawId, structureId));
    expect(completion.rounds.map((round) => round.openCount)).toEqual([4, 4, 4]);
    const after = completeThrough(drawId, structureId, 2);
    expect(openByRound(after)).toEqual([0, 0, 4]);
  });

  it('a round with nothing left, or before the first open one, has no count', () => {
    const { drawId, structureId } = seed({ drawSize: 8 });
    completeThrough(drawId, structureId, 1);
    const completion = completionRounds(structureMatchUps(drawId, structureId));
    expect(roundsToCompleteThrough(completion, 1)).toBeUndefined();
    expect(throughRoundSpan(completion, 1)).toEqual([]);
    expect(roundsToCompleteThrough(completionRounds([]), 1)).toBeUndefined();
  });
});
