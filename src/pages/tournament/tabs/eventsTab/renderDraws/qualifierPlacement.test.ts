import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';
import {
  buildPlaceQualifiersMethod,
  drawQualifierLot,
  getQualifierPlacementState,
  summarizeQualifierPlacement,
} from './qualifierPlacement';

// constants
import { QUALIFIER_PROGRESSION } from 'constants/mutationConstants';

const engine: any = tournamentEngine;
const identity = (values: number[]) => values;
const reverse = (values: number[]) => [...values].reverse();

// a 16 main draw with 4 qualifier positions, fed by a 16 qualifying draw that produces 4 qualifiers (two rounds)
function setupDrawWithQualifying() {
  const {
    tournamentRecord,
    drawIds: [drawId],
    eventIds: [eventId],
  } = mocksEngine.generateTournamentRecord({
    drawProfiles: [
      { drawSize: 16, qualifyingProfiles: [{ structureProfiles: [{ drawSize: 16, qualifyingPositions: 4 }] }] },
    ],
    setState: true,
  });
  expect(tournamentRecord).toBeDefined();
  return { drawId, eventId };
}

function qualifyingMatchUps(drawId: string) {
  const { matchUps } = engine.allTournamentMatchUps({ matchUpFilters: { drawIds: [drawId] } });
  return matchUps.filter(({ stage }: any) => stage === 'QUALIFYING');
}

// decides qualifying matchUps for side 1, round by round; `limit` stops after that many final-round results
function completeQualifying(drawId: string, limit = Infinity) {
  let finalRoundCompleted = 0;
  for (let pass = 0; pass < 10; pass++) {
    const matchUps = qualifyingMatchUps(drawId);
    const finalRound = Math.max(...matchUps.map(({ roundNumber }: any) => roundNumber));
    const ready = matchUps.filter((m: any) => m.readyToScore && !m.winningSide);
    if (!ready.length) return;
    for (const matchUp of ready) {
      if (matchUp.roundNumber === finalRound) {
        if (finalRoundCompleted >= limit) continue;
        finalRoundCompleted += 1;
      }
      const result = engine.setMatchUpStatus({
        outcome: { winningSide: 1, matchUpStatus: 'COMPLETED' },
        matchUpId: matchUp.matchUpId,
        drawId,
      });
      expect(result.success).toBe(true);
    }
    if (finalRoundCompleted >= limit && ready.every((m: any) => m.roundNumber === finalRound)) return;
  }
}

function mainAssignments(drawId: string, structureId: string) {
  return engine.getPositionAssignments({ drawId, structureId }).positionAssignments;
}

function placeQualifiers({ drawId, eventId, shuffle }: { drawId: string; eventId: string; shuffle?: any }) {
  const state = getQualifierPlacementState({ engine, drawId, eventId });
  const method = buildPlaceQualifiersMethod({
    positionsCount: state.openQualifierPositions.length,
    eventId,
    drawId,
    shuffle,
  });
  const result = engine.executionQueue([method]);
  expect(result.success).toBe(true);
  return { state, method, result };
}

describe('qualifier placement', () => {
  it('is not offered while nobody has qualified yet', () => {
    const { drawId, eventId } = setupDrawWithQualifying();
    const state = getQualifierPlacementState({ engine, drawId, eventId });
    expect(state.hasLinkedQualifying).toBe(true);
    expect(state.openQualifierPositions).toHaveLength(4);
    expect(state.qualifiedParticipantIds).toEqual([]);
    expect(state.eligible).toBe(false);
  });

  it('is not offered for a draw without qualifying', () => {
    const {
      drawIds: [drawId],
      eventIds: [eventId],
    } = mocksEngine.generateTournamentRecord({ drawProfiles: [{ drawSize: 16 }], setState: true });
    const state = getQualifierPlacementState({ engine, drawId, eventId });
    expect(state.hasLinkedQualifying).toBe(false);
    expect(state.openQualifierPositions).toEqual([]);
    expect(state.eligible).toBe(false);
  });

  it('places every qualifier into the open qualifier positions through the execution queue', () => {
    const { drawId, eventId } = setupDrawWithQualifying();
    completeQualifying(drawId);

    const before = getQualifierPlacementState({ engine, drawId, eventId });
    expect(before.eligible).toBe(true);
    expect(before.qualifiedParticipantIds).toHaveLength(4);

    const { method, result } = placeQualifiers({ drawId, eventId });
    expect(method.method).toEqual(QUALIFIER_PROGRESSION);
    expect([...method.params.randomList].sort()).toEqual([0, 1, 2, 3]);
    expect(method.params).toMatchObject({ drawId, eventId });

    const assignments = mainAssignments(drawId, before.mainStructureId!);
    const placedInQualifierPositions = before.openQualifierPositions.map(
      (drawPosition) => assignments.find((a: any) => a.drawPosition === drawPosition)?.participantId,
    );
    expect([...placedInQualifierPositions].sort()).toEqual([...before.qualifiedParticipantIds].sort());

    const summary = summarizeQualifierPlacement({
      qualifiedParticipantIds: before.qualifiedParticipantIds,
      positionsCount: before.openQualifierPositions.length,
      getName: (participantId) => `name-${participantId}`,
      result,
    });
    expect(summary.placed).toHaveLength(4);
    expect(summary.placed.map(({ drawPosition }) => drawPosition)).toEqual(
      [...before.openQualifierPositions].sort((a, b) => a - b),
    );
    expect(
      summary.placed.every(({ participantId, participantName }) => participantName === `name-${participantId}`),
    ).toBe(true);
    expect(summary.notPlaced).toEqual([]);
    expect(summary.openPositionsRemaining).toBe(0);
    expect(summary.incomplete).toBe(false);

    expect(getQualifierPlacementState({ engine, drawId, eventId }).eligible).toBe(false);
  });

  it('lets the lot, not the qualifying order, decide who goes where', () => {
    const placementsFor = (shuffle: any) => {
      const { drawId, eventId } = setupDrawWithQualifying();
      completeQualifying(drawId);
      const { state, result } = placeQualifiers({ drawId, eventId, shuffle });
      const summary = summarizeQualifierPlacement({
        qualifiedParticipantIds: state.qualifiedParticipantIds,
        positionsCount: state.openQualifierPositions.length,
        getName: () => undefined,
        result,
      });
      // index of each qualifier (in qualifying order) -> index of the qualifier position it took
      const positions = [...state.openQualifierPositions].sort((a, b) => a - b);
      return state.qualifiedParticipantIds.map((participantId) =>
        positions.indexOf(summary.placed.find((p) => p.participantId === participantId)!.drawPosition),
      );
    };

    expect(placementsFor(identity)).toEqual([0, 1, 2, 3]);
    expect(placementsFor(reverse)).toEqual([3, 2, 1, 0]);
  });

  it('reports open positions left over when fewer have qualified than there are positions', () => {
    const { drawId, eventId } = setupDrawWithQualifying();
    completeQualifying(drawId, 2);

    const before = getQualifierPlacementState({ engine, drawId, eventId });
    expect(before.eligible).toBe(true);
    expect(before.qualifiedParticipantIds).toHaveLength(2);

    const { result } = placeQualifiers({ drawId, eventId });
    const summary = summarizeQualifierPlacement({
      qualifiedParticipantIds: before.qualifiedParticipantIds,
      positionsCount: before.openQualifierPositions.length,
      getName: () => undefined,
      result,
    });
    expect(summary.placed.map(({ participantId }) => participantId).sort()).toEqual(
      [...before.qualifiedParticipantIds].sort(),
    );
    expect(summary.openPositionsRemaining).toBe(2);
    expect(summary.incomplete).toBe(true);

    const after = getQualifierPlacementState({ engine, drawId, eventId });
    expect(after.openQualifierPositions).toHaveLength(2);
    expect(after.eligible).toBe(false);
  });

  it('names the qualifiers the method skipped', () => {
    const summary = summarizeQualifierPlacement({
      result: {
        success: true,
        results: [{ success: true, assignedParticipants: [{ participantId: 'a', drawPosition: 5 }] }],
      },
      getName: (participantId) => (participantId === 'b' ? 'Bea' : undefined),
      qualifiedParticipantIds: ['a', 'b'],
      positionsCount: 2,
    });
    expect(summary.placed).toEqual([{ participantId: 'a', participantName: 'a', drawPosition: 5 }]);
    expect(summary.notPlaced).toEqual([{ participantId: 'b', participantName: 'Bea' }]);
    expect(summary.openPositionsRemaining).toBe(1);
    expect(summary.incomplete).toBe(true);
  });

  it('draws the lot as a permutation of the qualifier position indexes', () => {
    const lot = drawQualifierLot(6);
    expect([...lot].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(drawQualifierLot(0)).toEqual([]);
  });
});
