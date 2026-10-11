import { buildSettlementMethod, canSettleForProvider, getSettlementContext, previewSettlement } from './settlement';
import { beforeEach, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  engine: {
    getTournament: vi.fn(),
    getEvent: vi.fn(),
    allDrawMatchUps: vi.fn(),
    dryRun: vi.fn(),
    settleRotatingPartnerResult: vi.fn(),
    getRotatingPartnerStandings: vi.fn(),
  },
  login: undefined as any,
  user: undefined as any,
}));
vi.mock('services/factory/engine', () => ({ tournamentEngine: h.engine }));
vi.mock('services/authentication/loginState', () => ({ getLoginState: () => h.login }));
vi.mock('services/authentication/getUserContext', () => ({ getUserContext: () => h.user }));

beforeEach(() => {
  h.login = undefined;
  h.user = undefined;
  h.engine.getTournament.mockReturnValue({
    tournamentRecord: {
      tournamentId: 't',
      participants: ['a', 'b', 'c', 'd'].map((participantId) => ({ participantId, participantName: participantId })),
    },
  });
  h.engine.getEvent.mockReturnValue({
    drawDefinition: {
      drawId: 'draw',
      competitionProfile: { format: 'MEXICANO' },
      competitionRounds: [
        {
          roundNumber: 1,
          matchUpIds: ['m'],
          pairings: [
            [
              ['a', 'b'],
              ['c', 'd'],
            ],
          ],
        },
      ],
    },
  });
  h.engine.allDrawMatchUps.mockReturnValue({
    matchUps: [
      {
        matchUpId: 'm',
        matchUpStatus: 'RETIRED',
        winningSide: 1,
        score: { sets: [{ side1Score: 10, side2Score: 8 }] },
      },
    ],
  });
  h.engine.getTournament().tournamentRecord.events = [{ drawDefinitions: [h.engine.getEvent().drawDefinition] }];
  h.engine.dryRun.mockReset();
});

it('uses the specific applied match, a detached sporting snapshot and latest settlement identity', () => {
  const draw = h.engine.getEvent().drawDefinition;
  draw.competitionSettlements = [
    { requestId: 'old', matchUpId: 'm' },
    { requestId: 'later', matchUpId: 'm' },
  ];
  const context = getSettlementContext('draw', 'm')!;
  expect(context.playerIds).toEqual(['a', 'b', 'c', 'd']);
  expect(context.supersedesRequestId).toBe('later');
  h.engine.allDrawMatchUps().matchUps[0].score.sets[0].side1Score = 12;
  expect(context.expectedOutcome.score?.sets?.[0].side1Score).toBe(10);
});

it.each(['TO_BE_PLAYED', 'IN_PROGRESS', 'COMPLETED'])('does not offer settlement for %s', (matchUpStatus) => {
  h.engine.allDrawMatchUps.mockReturnValue({ matchUps: [{ matchUpId: 'm', matchUpStatus }] });
  expect(getSettlementContext('draw', 'm')).toBeUndefined();
});

it('does not offer a terminal ordinary match or a match outside the applied rounds', () => {
  h.engine.getEvent().drawDefinition.competitionProfile.format = 'LADDER';
  expect(getSettlementContext('draw', 'm')).toBeUndefined();
  h.engine.getEvent().drawDefinition.competitionProfile.format = 'AMERICANO';
  expect(getSettlementContext('draw', 'untracked')).toBeUndefined();
});

it('hides controls when the published engine has no settlement method', () => {
  const original = h.engine.settleRotatingPartnerResult;
  Object.assign(h.engine, { settleRotatingPartnerResult: undefined });
  try {
    expect(getSettlementContext('draw', 'm')).toBeUndefined();
  } finally {
    h.engine.settleRotatingPartnerResult = original;
  }
});

it('limits provider-owned settlements to directors/admins of that provider', () => {
  const login = { roles: [], providerAssociations: [{ providerId: 'p', providerRole: 'DIRECTOR' }] } as any;
  expect(canSettleForProvider('p', login)).toBe(true);
  expect(canSettleForProvider('other', login)).toBe(false);
  expect(
    canSettleForProvider('p', { ...login, providerAssociations: [{ providerId: 'p', providerRole: 'VIEWER' }] }),
  ).toBe(false);
  expect(canSettleForProvider('p', { ...login, roles: ['superadmin'] })).toBe(true);
  expect(canSettleForProvider('p')).toBe(false);
  expect(canSettleForProvider()).toBe(true);
  // A fresh /auth/me role takes precedence over stale JWT associations.
  expect(canSettleForProvider('p', login, { providerRoles: { p: 'VIEWER' } } as any)).toBe(false);
});

it('builds one audited factory directive and previews all four credits using a dry run', () => {
  const context = getSettlementContext('draw', 'm')!;
  const method = buildSettlementMethod(context, {
    requestId: 'r',
    reason: 'Director ruling',
    recordedBy: 'operator',
    recordedAt: '2026-10-10T12:00:00Z',
    treatment: { kind: 'CREDIT', winningPoints: 16, losingPoints: 8 },
  });
  h.engine.dryRun.mockReturnValue({
    wouldSucceed: true,
    results: [
      { success: true },
      {
        contributions: context.playerIds.map((participantId, side) => ({
          participantId,
          matchUpId: 'm',
          pointsScored: side < 2 ? 16 : 8,
        })),
        standings: context.playerIds.map((participantId) => ({ participantId, pointsScored: 40 })),
      },
    ],
  });
  const preview = previewSettlement(context, method);
  expect(h.engine.dryRun).toHaveBeenCalledWith([
    method,
    { method: 'getRotatingPartnerStandings', params: { drawId: 'draw' } },
  ]);
  expect(preview.players?.map((player) => player.points)).toEqual([16, 16, 8, 8]);
  expect(preview.players?.map((player) => player.total)).toEqual([40, 40, 40, 40]);
  expect(method.params?.expectedOutcome).toEqual(context.expectedOutcome);
  expect(method.params?.expectedOutcome).not.toBe(context.expectedOutcome);
});

it('surfaces the factory refusal and never treats it as an approved preview', () => {
  h.engine.dryRun.mockReturnValue({
    wouldSucceed: false,
    error: { message: 'Invalid values' },
    results: [{ error: {}, info: 'stale settlement outcome' }],
  });
  expect(previewSettlement(getSettlementContext('draw', 'm')!, { method: 'settleRotatingPartnerResult' })).toEqual({
    error: 'stale settlement outcome',
  });
});
