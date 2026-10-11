import { getUserContext } from 'services/authentication/getUserContext';
import { getLoginState } from 'services/authentication/loginState';
import { matchUpStatusConstants } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';

// constants and types
import { GET_ROTATING_PARTNER_STANDINGS, SETTLE_ROTATING_PARTNER_RESULT } from 'constants/mutationConstants';
import { SUPER_ADMIN, PROVIDER_ADMIN } from 'constants/tmxConstants';
import type { MatchUp, Score } from 'tods-competition-factory';
import type { LoginState, UserContext } from 'types/tmx';
import type { MutationMethod } from 'types/services';

/** Consumer projection until the factory release exports the new contract. */
export type SettlementTreatment =
  { kind: 'EXCLUDE' } | { kind: 'PLAYED_POINTS' } | { kind: 'CREDIT'; winningPoints: number; losingPoints: number };

export type SettlementContext = {
  drawId: string;
  matchUpId: string;
  roundNumber: number;
  expectedOutcome: { matchUpStatus: MatchUp['matchUpStatus']; winningSide?: number; score?: Score };
  supersedesRequestId?: string;
  names: Map<string, string>;
  playerIds: string[];
};

type RotatingDraw = {
  competitionProfile?: { format?: string };
  competitionRounds?: { roundNumber: number; matchUpIds: string[]; pairings: [[string, string], [string, string]][] }[];
  competitionSettlements?: { requestId: string; matchUpId: string }[];
};

// Menu eligibility only; factory dryRun remains authoritative for contract validation.
const terminal = new Set<string>([
  matchUpStatusConstants.CANCELLED,
  matchUpStatusConstants.ABANDONED,
  matchUpStatusConstants.DEAD_RUBBER,
  matchUpStatusConstants.DEFAULTED,
  matchUpStatusConstants.DOUBLE_WALKOVER,
  matchUpStatusConstants.DOUBLE_DEFAULT,
  matchUpStatusConstants.RETIRED,
  matchUpStatusConstants.WALKOVER,
]);

export function canSettleForProvider(providerId?: string, login?: LoginState, user?: UserContext): boolean {
  // A providerless local tournament is managed by its local operator.
  if (!providerId) return true;
  if (user?.isSuperAdmin || login?.roles?.some((role) => role === SUPER_ADMIN)) return true;
  if (user?.provisionerProviderIds?.includes(providerId)) return true;
  if (login?.provisionerProviders?.some((provider) => provider.providerId === providerId)) return true;
  const role =
    user?.providerRoles?.[providerId] ??
    login?.providerAssociations?.find((association) => association.providerId === providerId)?.providerRole;
  return new Set([PROVIDER_ADMIN, 'DIRECTOR']).has(role ?? '');
}

export function getSettlementContext(drawId: string, matchUpId: string): SettlementContext | undefined {
  // Capabilities are read at invocation so a future published factory can enable this UI.
  if (
    typeof Reflect.get(tournamentEngine, SETTLE_ROTATING_PARTNER_RESULT) !== 'function' ||
    typeof Reflect.get(tournamentEngine, GET_ROTATING_PARTNER_STANDINGS) !== 'function'
  )
    return undefined;
  const record = tournamentEngine.getTournament().tournamentRecord;
  if (!record || !canSettleForProvider(record.parentOrganisation?.organisationId, getLoginState(), getUserContext()))
    return undefined;
  const { drawDefinition } = tournamentEngine.getEvent({ drawId });
  const draw = drawDefinition as RotatingDraw | undefined;
  if (!new Set(['AMERICANO', 'MEXICANO']).has(draw?.competitionProfile?.format ?? '')) return undefined;
  const round = draw?.competitionRounds?.find((candidate) => new Set(candidate.matchUpIds).has(matchUpId));
  const matchUp = tournamentEngine
    .allDrawMatchUps({ drawId, inContext: true })
    .matchUps?.find((candidate) => candidate.matchUpId === matchUpId);
  if (!round || !matchUp || !terminal.has(matchUp.matchUpStatus ?? '')) return undefined;
  const pairing = round.pairings[round.matchUpIds.indexOf(matchUpId)];
  if (!pairing) return undefined;
  const prior = draw?.competitionSettlements?.findLast((entry) => entry.matchUpId === matchUpId);
  return {
    drawId,
    matchUpId,
    roundNumber: round.roundNumber,
    playerIds: pairing.flat(),
    names: new Map((record.participants ?? []).map((player) => [player.participantId, player.participantName ?? ''])),
    expectedOutcome: structuredClone({
      matchUpStatus: matchUp.matchUpStatus,
      ...(matchUp.winningSide !== undefined ? { winningSide: matchUp.winningSide } : {}),
      ...(matchUp.score ? { score: matchUp.score } : {}),
    }),
    ...(prior ? { supersedesRequestId: prior.requestId } : {}),
  };
}

export function buildSettlementMethod(
  context: SettlementContext,
  decision: {
    requestId: string;
    treatment: SettlementTreatment;
    reason: string;
    recordedBy: string;
    recordedAt: string;
  },
): MutationMethod {
  return {
    method: SETTLE_ROTATING_PARTNER_RESULT,
    params: {
      drawId: context.drawId,
      matchUpId: context.matchUpId,
      expectedOutcome: structuredClone(context.expectedOutcome),
      ...structuredClone(decision),
      ...(context.supersedesRequestId ? { supersedesRequestId: context.supersedesRequestId } : {}),
    },
  };
}

/** Factory preflight: show actual tally impact without notifying subscribers or persisting. */
export function previewSettlement(context: SettlementContext, method: MutationMethod) {
  const result = tournamentEngine.dryRun([
    method,
    { method: GET_ROTATING_PARTNER_STANDINGS, params: { drawId: context.drawId } },
  ]);
  if (!result.wouldSucceed)
    return { error: result.results.find((entry) => entry.error)?.info ?? result.error?.message };
  const standings = result.results.at(-1);
  return {
    success: true,
    players: context.playerIds.map((participantId) => ({
      participantId,
      participantName: context.names.get(participantId) ?? participantId,
      points:
        (standings.contributions ?? []).find(
          (entry) => entry.matchUpId === context.matchUpId && entry.participantId === participantId,
        )?.pointsScored ?? 0,
      total: (standings.standings ?? []).find((entry) => entry.participantId === participantId)?.pointsScored ?? 0,
    })),
  };
}
