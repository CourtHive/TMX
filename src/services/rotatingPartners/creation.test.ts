import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('services/factory/engine', async () => {
  const factory = await import('tods-competition-factory');
  return { tournamentEngine: factory.tournamentEngine };
});

import type { RotatingCreation } from './creation';
import { prepareRotatingDraw } from './creation';

function setup(count = 8) {
  const generated = mocksEngine.generateTournamentRecord({ participantsProfile: { participantsCount: count } });
  const record = generated.tournamentRecord;
  record.events = [{ eventId: 'doubles', eventName: 'Doubles', eventType: 'DOUBLES' }];
  tournamentEngine.setState(record);
  return record.participants.map((participant) => participant.participantId);
}

function config(participantIds: string[], format: RotatingCreation['format'] = 'AMERICANO'): RotatingCreation {
  return { format, participantIds, combinedPointTotal: 32, rounds: 3, selectedVariant: { tieResolution: 'ALLOW' } };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-13T12:00:00Z'));
});
afterEach(() => {
  tournamentEngine.reset();
  vi.useRealTimers();
});

it.each(['AMERICANO', 'MEXICANO'] as const)(
  'creates an empty %s draw with individuals, then applies its first round',
  (format) => {
    const participantIds = setup();
    const before = tournamentEngine.getTournament().tournamentRecord;
    const prepared = prepareRotatingDraw('doubles', 'Rotation', config(participantIds, format), 42);
    expect(prepared.error).toBeUndefined();
    expect(tournamentEngine.getTournament().tournamentRecord).toEqual(before);
    expect(tournamentEngine.executionQueue(prepared.methods).success).toBe(true);
    const drawId = prepared.drawDefinition!.drawId;
    const draw = tournamentEngine.getEvent({ drawId }).drawDefinition!;
    expect(draw.entries!.map((entry) => entry.participantId).sort()).toEqual([...participantIds].sort());
    expect(draw.structures!.flatMap((structure) => structure.matchUps ?? [])).toHaveLength(0);
    const preview = tournamentEngine.getRotatingPartnerRoundPreview({ drawId, roundNumber: 1 });
    expect(preview.error).toBeUndefined();
    expect(preview.round).toHaveLength(2);
    const params = {
      drawId,
      roundNumber: 1,
      requestId: 'round-one',
      expectedPairings: preview.round!,
      expectedScoringContract: preview.scoringContract!,
    };
    expect(tournamentEngine.generateRotatingPartnerRound(params).success).toBe(true);
    expect(tournamentEngine.generateRotatingPartnerRound(params).success).toBe(true);
    expect(tournamentEngine.allDrawMatchUps({ drawId }).matchUps).toHaveLength(2);
    const next = tournamentEngine.getRotatingPartnerRoundPreview({ drawId, roundNumber: 2 });
    if (format === 'MEXICANO') {
      expect(next.info).toContain('unresolved');
      for (const matchUp of tournamentEngine.allDrawMatchUps({ drawId }).matchUps!) {
        expect(
          tournamentEngine.setMatchUpStatus({
            drawId,
            matchUpId: matchUp.matchUpId,
            outcome: {
              winningSide: 1,
              matchUpStatus: 'COMPLETED',
              score: { sets: [{ setNumber: 1, side1Score: 20, side2Score: 12, winningSide: 1 }] },
            },
          }),
        ).toMatchObject({ success: true });
      }
      const scoredPreview = tournamentEngine.getRotatingPartnerRoundPreview({ drawId, roundNumber: 2 });
      expect(scoredPreview).toMatchObject({ success: true });
      expect(scoredPreview.round).toHaveLength(2);
      expect(tournamentEngine.getRotatingPartnerStandings({ drawId }).unresolved).toHaveLength(0);
    } else expect(next.round).toHaveLength(2);
  },
);

it('refuses a six-player roster without changing the tournament', () => {
  const participantIds = setup(6);
  const before = tournamentEngine.getTournament().tournamentRecord;
  expect(prepareRotatingDraw('doubles', 'Rotation', config(participantIds), 42).error).toBe('roster');
  expect(tournamentEngine.getTournament().tournamentRecord).toEqual(before);
});

it('refuses a scoring choice forbidden by inherited policy before creating the draw', () => {
  const participantIds = setup();
  tournamentEngine.attachPolicies({
    policyDefinitions: {
      scoring: {
        rotatingPartners: {
          AMERICANO: {
            defaultVariant: { tieResolution: 'DECIDING_POINT' },
            permittedVariants: [{ tieResolution: 'DECIDING_POINT' }],
            permittedPointTotals: [24],
          },
        },
      },
    },
  });
  const before = tournamentEngine.getTournament().tournamentRecord;
  const prepared = prepareRotatingDraw('doubles', 'Rotation', config(participantIds), 42);
  expect(prepared.methods).toEqual([]);
  expect(prepared.drawDefinition).toBeUndefined();
  expect(tournamentEngine.getTournament().tournamentRecord).toEqual(before);
});
