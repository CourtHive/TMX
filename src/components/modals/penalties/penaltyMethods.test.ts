/**
 * Correcting and withdrawing an issued penalty, through the real engine.
 */
import { modifyPenaltyMethod, penaltyRows, removePenaltyMethod } from './penaltyMethods';
import { mocksEngine, penaltyConstants, tournamentEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';

// typed loosely: the engine's penaltyType is a closed union, and these come from its own constants
const [firstType, secondType]: any[] = [...new Set(Object.values(penaltyConstants) as string[])];

function penalized() {
  mocksEngine.generateTournamentRecord({ participantsProfile: { participantsCount: 4 }, setState: true });
  const [{ participantId }, other] = tournamentEngine.getParticipants().participants ?? [];
  const result: any = tournamentEngine.addPenalty({
    participantIds: [participantId],
    penaltyType: firstType,
    notes: 'first note',
  });
  expect(result.success).toEqual(true);
  return { participantId, otherId: other.participantId, penaltyId: result.penaltyId };
}

const penaltiesOf = (participantId: string) =>
  penaltyRows(tournamentEngine.findParticipant({ participantId }).participant);

describe('correcting an issued penalty', () => {
  it('changes the penalty type and the note', () => {
    const { participantId, penaltyId } = penalized();

    const result: any = tournamentEngine.executionQueue(
      [modifyPenaltyMethod({ penaltyId, penaltyType: secondType, notes: '  corrected  ' })],
      true,
    );

    expect(result.success).toEqual(true);
    expect(penaltiesOf(participantId)).toMatchObject([{ penaltyId, penaltyType: secondType, notes: 'corrected' }]);
  });

  it('an emptied note is removed', () => {
    const { participantId, penaltyId } = penalized();

    const result: any = tournamentEngine.executionQueue(
      [modifyPenaltyMethod({ penaltyId, penaltyType: firstType, notes: '   ' })],
      true,
    );

    expect(result.success).toEqual(true);
    expect(penaltiesOf(participantId)[0].notes).toBeUndefined();
  });

  it('withdraws the penalty', () => {
    const { participantId, otherId, penaltyId } = penalized();
    const other: any = tournamentEngine.addPenalty({ participantIds: [otherId], penaltyType: firstType });
    expect(other.success).toEqual(true);

    const result: any = tournamentEngine.executionQueue([removePenaltyMethod(penaltyId)], true);

    expect(result.success).toEqual(true);
    expect(penaltiesOf(participantId)).toEqual([]);
    // only that penalty: another participant's is untouched
    expect(penaltiesOf(otherId).map(({ penaltyId }) => penaltyId)).toEqual([other.penaltyId]);
  });

  it('lists penalties newest first', () => {
    expect(
      penaltyRows({
        penalties: [
          { penaltyId: 'a', penaltyType: firstType, issuedAt: '2026-10-01T10:00:00Z' },
          { penaltyId: 'b', penaltyType: firstType, issuedAt: '2026-10-02T10:00:00Z' },
          { penaltyType: firstType },
        ],
      }).map(({ penaltyId }) => penaltyId),
    ).toEqual(['b', 'a']);
  });
});
