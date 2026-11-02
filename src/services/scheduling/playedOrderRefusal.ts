import { matchUpLabel } from 'pages/tournament/tabs/scheduleViews/matchUpReadiness';
import { tournamentEngine } from 'services/factory/engine';
import { t } from 'i18n';

// constants and types
import type { ErrorCode } from 'tods-competition-factory';

const ANACHRONISM: ErrorCode = 'ANACHRONISM';

type BlockingMatchUp = {
  relation: 'source' | 'playedSource' | 'dependent';
  scheduledDate?: string;
  scheduledTime?: string;
  startTime?: string;
  endTime?: string;
  roundNumber?: number;
  matchUpId: string;
};

/**
 * The factory refuses a schedule write that breaks the order of linked matchUps (`ANACHRONISM`, with
 * `context.blockingMatchUps`): a matchUp placed at or before one it depends on, played or only scheduled, or after one
 * that depends on it; or recorded start and end times that overlap a linked match's (CA 2026-10-30). This says which
 * match stands in the way, so a refused drag or save does not simply snap back. Undefined for any other result, so a
 * caller falls back to its own message.
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
  const message = t(refusalKey(result, first), { matchUp, when: whenOf(result, first) });
  return blocking.length > 1
    ? `${message} ${t('toasts.schedule.moreBlocking', { count: blocking.length - 1 })}`
    : message;
}

// a refusal of recorded times names the times it judged; a refusal of a placement does not
const isRecorded = (result: any) => !!(result?.context?.startTime || result?.context?.endTime);

function refusalKey(result: any, first: BlockingMatchUp): string {
  if (isRecorded(result)) {
    return first.relation === 'dependent' ? 'toasts.schedule.overlapsDependent' : 'toasts.schedule.overlapsSource';
  }
  if (first.relation === 'dependent') return 'toasts.schedule.afterDependent';
  if (first.relation === 'source') return 'toasts.schedule.beforeSource';
  return 'toasts.schedule.beforePlayedSource';
}

function whenOf(result: any, first: BlockingMatchUp): string {
  if (isRecorded(result)) return [first.startTime, first.endTime].filter(Boolean).join('–');
  return [first.scheduledDate, first.scheduledTime].filter(Boolean).join(' ');
}

function engineMatchUpLabel(matchUpId: string): string | undefined {
  const matchUp = tournamentEngine.allTournamentMatchUps({ matchUpFilters: { matchUpIds: [matchUpId] } })
    ?.matchUps?.[0];
  return matchUp ? matchUpLabel(matchUp) : undefined;
}
