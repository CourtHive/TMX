import { drawDefinitionConstants, mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { completeMatchUps } from './devCompleteMatchUps';

const { LUCKY_DRAW } = drawDefinitionConstants;

// Applies the methods to the local engine, as an acknowledged mutation would.
const mutationRequestMock = vi.fn(({ methods, callback }: any) => callback(tournamentEngine.executionQueue(methods)));
vi.mock('services/mutation/mutationRequest', () => ({ mutationRequest: (p: any) => mutationRequestMock(p) }));
vi.mock('components/tables/common/navigateToEvent', () => ({ navigateToEvent: vi.fn() }));
vi.mock('functions/logMutationError', () => ({ logMutationError: vi.fn() }));

/**
 * "Complete all matchUps" completes every matchUp that CAN be completed (CA 2026-10-29). In a lucky draw that
 * stops before the lucky loser choice by itself: the round a lucky loser is fed into keeps an open position until
 * one is placed. The control used to cap a lucky draw at the matchUps ready when it was pressed, which stopped a
 * 24-draw after round 1 although no choice was due until after round 3.
 */
describe('completeMatchUps', () => {
  beforeEach(() => {
    mutationRequestMock.mockClear();
    (globalThis as any).location = { hash: '' };
  });

  function luckyDraw(drawSize: number) {
    const {
      drawIds: [drawId],
    } = mocksEngine.generateTournamentRecord({ drawProfiles: [{ drawSize, drawType: LUCKY_DRAW }], setState: true });
    const structureId = tournamentEngine.getEvent({ drawId }).drawDefinition.structures[0].structureId;
    return { drawId, structureId };
  }

  function playedByRound(drawId: string): number[] {
    const matchUps = tournamentEngine.allDrawMatchUps({ drawId }).matchUps ?? [];
    const roundNumbers = [...new Set(matchUps.map((m: any) => m.roundNumber))].sort((a: any, b: any) => a - b);
    return roundNumbers.map((rn) => matchUps.filter((m: any) => m.roundNumber === rn && m.winningSide).length);
  }

  it('sends one completion scoped to the structure, with no cap', () => {
    const { drawId, structureId } = luckyDraw(24);
    completeMatchUps({ drawId, structureId });

    expect(mutationRequestMock).toHaveBeenCalledTimes(1);
    const [{ methods }] = mutationRequestMock.mock.calls[0];
    expect(methods).toEqual([{ method: 'completeDrawMatchUps', params: { drawId, structureIds: [structureId] } }]);
  });

  it('a lucky draw plays every round it can, up to the lucky loser choice', () => {
    const { drawId, structureId } = luckyDraw(24);
    completeMatchUps({ drawId, structureId });

    // 12 -> 6 -> 3: round 3 is odd, so round 4 waits on a lucky loser and nothing after it is played
    expect(playedByRound(drawId)).toEqual([12, 6, 3, 0, 0]);
    const status = tournamentEngine.getLuckyDrawRoundStatus({ drawId, structureId });
    expect((status.rounds ?? []).filter((r: any) => r.needsLuckySelection).map((r: any) => r.roundNumber)).toEqual([3]);
  });
});
