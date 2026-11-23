/**
 * Carryover: matchUps still dated on a day that has passed without a result (CA 2026-11-22, Battle of Boca).
 *
 * The factory orders a draw by its plan as well as its history (`getMatchUpScheduleBounds`, `plannedOrder: true`): a
 * matchUp may not be dated after a matchUp it feeds. A carryover that still has an unresulted matchUp feeding it is
 * therefore a dead end. That feeder can only be played today or later, which is after the carryover's date, so
 * no date the operator picks for it passes the order rule, and the date picker offers nothing past yesterday. Such a
 * carryover is BLOCKING: until its own date moves, every matchUp upstream of it is stuck.
 *
 * A carryover whose feeders are all decided blocks nothing: it is a match to re-place, not a dead end.
 *
 * Pure: the caller hands in the matchUps, their dependency map and the venue's today.
 */
import { factoryConstants } from 'tods-competition-factory';

const CONCLUDED_STATUSES = new Set<string>([...factoryConstants.completedMatchUpStatuses, 'BYE']);
/** a match already on court yesterday: listed, never cleared by default, since clearing it is rarely what is meant */
const UNDER_WAY_STATUSES = new Set<string>(['IN_PROGRESS', 'SUSPENDED', 'AWAITING_RESULT']);

export type CarryoverItem = {
  matchUpId: string;
  drawId: string;
  scheduledDate: string;
  scheduledTime?: string;
  matchUpStatus?: string;
  /** the unresulted matchUps upstream of this one: each can only be dated after it, so each is stuck */
  heldBackMatchUpIds: string[];
  /** a match already started; offered, not selected by default */
  underWay: boolean;
  matchUp: any;
};

export type CarryoverAnalysis = {
  /** every unresulted matchUp dated before today, oldest first */
  carryover: CarryoverItem[];
  /** the carryover that leaves matchUps upstream of it with no date they may take */
  blocking: CarryoverItem[];
  /** every matchUp a blocking carryover holds back, once each */
  heldBackMatchUpIds: string[];
};

export function isConcluded(matchUp: any): boolean {
  return !!matchUp?.winningSide || CONCLUDED_STATUSES.has(matchUp?.matchUpStatus);
}

export function analyzeCarryover({
  matchUpDependencies = {},
  matchUps = [],
  today,
}: {
  matchUpDependencies?: Record<string, { matchUpIds?: string[] }>;
  matchUps?: any[];
  /** the venue's calendar day, `YYYY-MM-DD` */
  today: string;
}): CarryoverAnalysis {
  const byId = new Map(matchUps.map((matchUp) => [matchUp.matchUpId, matchUp]));

  const carryover: CarryoverItem[] = [];
  for (const matchUp of matchUps) {
    const scheduledDate = matchUp?.schedule?.scheduledDate;
    if (!scheduledDate || scheduledDate >= today || isConcluded(matchUp)) continue;
    const heldBackMatchUpIds = (matchUpDependencies[matchUp.matchUpId]?.matchUpIds ?? []).filter((id) => {
      const upstream = byId.get(id);
      return !!upstream && !isConcluded(upstream);
    });
    carryover.push({
      underWay: UNDER_WAY_STATUSES.has(matchUp.matchUpStatus),
      scheduledTime: matchUp.schedule?.scheduledTime || undefined,
      matchUpStatus: matchUp.matchUpStatus,
      matchUpId: matchUp.matchUpId,
      drawId: matchUp.drawId,
      heldBackMatchUpIds,
      scheduledDate,
      matchUp,
    });
  }

  carryover.sort(
    (a, b) =>
      a.scheduledDate.localeCompare(b.scheduledDate) || (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? ''),
  );
  const blocking = carryover.filter((item) => item.heldBackMatchUpIds.length > 0);
  const heldBackMatchUpIds = [...new Set(blocking.flatMap((item) => item.heldBackMatchUpIds))];

  return { carryover, blocking, heldBackMatchUpIds };
}
