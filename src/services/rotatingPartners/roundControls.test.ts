import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { previewRotatingRound } from './roundControls';
import { prepareRotatingDraw } from './creation';

const modal = vi.hoisted(() => ({ open: vi.fn(), close: vi.fn() }));
vi.mock('courthive-components', () => ({ cModal: modal }));
vi.mock('services/factory/engine', async () => ({
  tournamentEngine: (await import('tods-competition-factory')).tournamentEngine,
}));
vi.mock('services/mutation/mutationRequest', async () => {
  const { tournamentEngine } = await import('tods-competition-factory');
  return { mutationRequest: ({ methods, callback }: any) => callback(tournamentEngine.executionQueue(methods)) };
});
vi.mock('services/notifications/tmxToast', () => ({ tmxToast: vi.fn() }));
vi.mock('i18n', () => ({ t: (key: string) => key }));

afterEach(() => {
  tournamentEngine.reset();
  vi.unstubAllGlobals();
});

describe('the next rotating round from an existing menu callback', () => {
  it.each(['AMERICANO', 'MEXICANO'] as const)(
    '%s reads current engine matchUps rather than a captured structure',
    (format) => {
      vi.stubGlobal('document', { createElement: () => ({ appendChild: vi.fn(), textContent: '' }) });
      const { tournamentRecord } = mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        participantsProfile: { participantsCount: 8 },
      });
      tournamentRecord.events = [{ eventId: 'doubles', eventName: 'Doubles', eventType: 'DOUBLES' }];
      tournamentEngine.setState(tournamentRecord);
      const prepared = prepareRotatingDraw(
        'doubles',
        'Rotation',
        {
          format,
          participantIds: tournamentRecord.participants!.map((p) => p.participantId),
          combinedPointTotal: 32,
          rounds: 3,
          selectedVariant: { tieResolution: 'ALLOW' },
        },
        1,
      );
      let result: any = tournamentEngine.executionQueue(prepared.methods);
      expect(result).toMatchObject({ success: true });
      const drawId = prepared.drawDefinition!.drawId;
      const structureId = prepared.drawDefinition!.structures![0].structureId;
      const completeRound = (roundNumber: number) => {
        for (const matchUp of tournamentEngine.allDrawMatchUps({ drawId }).matchUps ?? []) {
          if (matchUp.roundNumber !== roundNumber) continue;
          result = tournamentEngine.setMatchUpStatus({
            drawId,
            matchUpId: matchUp.matchUpId,
            outcome: {
              matchUpStatus: 'COMPLETED',
              winningSide: 1,
              score: { sets: [{ setNumber: 1, side1Score: 20, side2Score: 12, winningSide: 1 }] },
            },
          });
          expect(result).toMatchObject({ success: true });
        }
      };

      // A summary with no matchUps: the old code asked for round 1 again.
      previewRotatingRound({ drawId, structure: { structureId, matchUps: [] } });
      expect(modal.open).toHaveBeenCalledOnce();
      modal.open.mock.calls[0][0].buttons[1].onClick();
      completeRound(1);
      const roundOneSummary = { structureId, matchUps: tournamentEngine.allDrawMatchUps({ drawId }).matchUps };

      previewRotatingRound({ drawId, structure: { structureId } });
      expect(modal.open).toHaveBeenCalledTimes(2);
      modal.open.mock.calls[1][0].buttons[1].onClick();
      completeRound(2);

      // A summary captured before round 2 was applied: the old code asked for round 2 again.
      previewRotatingRound({ drawId, structure: roundOneSummary });
      expect(modal.open).toHaveBeenCalledTimes(3);
      modal.open.mock.calls[2][0].buttons[1].onClick();

      const draw = tournamentEngine.getEvent({ drawId }).drawDefinition!;
      expect(draw.competitionRounds?.map((round) => round.roundNumber)).toEqual([1, 2, 3]);
      expect(tournamentEngine.allDrawMatchUps({ drawId }).matchUps).toHaveLength(6);
    },
  );
});
