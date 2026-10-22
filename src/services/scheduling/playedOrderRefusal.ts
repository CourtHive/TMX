import { matchUpLabel } from 'pages/tournament/tabs/scheduleViews/matchUpReadiness';
import { tournamentEngine } from 'services/factory/engine';
import { t } from 'i18n';

// constants and types
import type { ErrorCode } from 'tods-competition-factory';

const ANACHRONISM: ErrorCode = 'ANACHRONISM';

type BlockingMatchUp = {
  relation: 'playedSource' | 'dependent';
  scheduledDate?: string;
  scheduledTime?: string;
  roundNumber?: number;
  matchUpId: string;
};

/**
 * The factory refuses a schedule write that would put a matchUp at or before a PLAYED matchUp it depends on, or a
 * played matchUp after one that depends on it (`ANACHRONISM`, with `context.blockingMatchUps`). This says which match
 * stands in the way, so a refused drag or save does not simply snap back. Undefined for any other result, so a caller
 * falls back to its own message.
 */
export function playedOrderRefusalMessage(
  result: any,
  labelOf: (matchUpId: string) => string | undefined = engineMatchUpLabel,
): string | undefined {
  if (result?.error?.code !== ANACHRONISM) return undefined;
  const blocking: BlockingMatchUp[] = result?.context?.blockingMatchUps ?? [];
  const [first] = blocking;
  if (!first) return undefined;

  const matchUp =
    labelOf(first.matchUpId) ?? t('toasts.schedule.roundLabel', { roundNumber: first.roundNumber ?? '?' });
  const when = [first.scheduledDate, first.scheduledTime].filter(Boolean).join(' ');
  const key = first.relation === 'dependent' ? 'toasts.schedule.afterDependent' : 'toasts.schedule.beforePlayedSource';
  const message = t(key, { matchUp, when });
  return blocking.length > 1
    ? `${message} ${t('toasts.schedule.moreBlocking', { count: blocking.length - 1 })}`
    : message;
}

function engineMatchUpLabel(matchUpId: string): string | undefined {
  const matchUp = tournamentEngine.allTournamentMatchUps({ matchUpFilters: { matchUpIds: [matchUpId] } })
    ?.matchUps?.[0];
  return matchUp ? matchUpLabel(matchUp) : undefined;
}
