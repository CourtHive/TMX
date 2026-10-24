/**
 * Turn a live-tracked score into something a TD can read: a compact string for
 * table cells, and a display-only matchUp overlay for the bracket renderer.
 *
 * A live score is unofficial. It is shown only while the matchUp carries no
 * official result, it never sets the matchUp's `winningSide`, and the overlay
 * is a copy: the engine's matchUp — which every scoring click resolves by id —
 * is never touched.
 */
import type { LiveScore, LiveSet, LiveTrackedEntry } from './liveTrackedScores';

const OFFICIAL_ENDING_STATUSES = new Set([
  'COMPLETED',
  'RETIRED',
  'DEFAULTED',
  'WALKOVER',
  'DOUBLE_WALKOVER',
  'DOUBLE_DEFAULT',
  'CANCELLED',
  'ABANDONED',
  'DEAD_RUBBER',
]);

const hasValue = (v: unknown) => v !== undefined && v !== null && v !== '';

/** True when the matchUp already carries a result the TD (or a trusted path) entered. */
export function hasOfficialScore(matchUp: any): boolean {
  if (!matchUp) return false;
  if (matchUp.winningSide || OFFICIAL_ENDING_STATUSES.has(matchUp.matchUpStatus)) return true;
  const sets = matchUp.score?.sets ?? [];
  const setHasGames = (s: any) => (s?.side1Score ?? 0) > 0 || (s?.side2Score ?? 0) > 0;
  return sets.some(setHasGames) || !!matchUp.score?.scoreStringSide1;
}

function formatSet(set: LiveSet): string {
  const games = `${set.side1Score ?? 0}-${set.side2Score ?? 0}`;
  const tb1 = set.side1TiebreakScore;
  const tb2 = set.side2TiebreakScore;
  if (!hasValue(tb1) && !hasValue(tb2)) return games;
  const loserTb = (set.side1Score ?? 0) > (set.side2Score ?? 0) ? tb2 : tb1;
  return `${games}(${loserTb ?? 0})`;
}

/**
 * Compact side-1-perspective string, e.g. `6-3 2-1 (30-15)`. Game points come
 * from the last set when the producer sent them. Falls back to the producer's
 * own string when it sent no sets.
 */
export function formatLiveScore(score: LiveScore | undefined): string {
  if (!score) return '';
  const sets = score.sets ?? [];
  if (!sets.length) return score.scoreStringSide1 ?? '';
  const games = sets.map(formatSet).join(' ');
  const last = sets.at(-1)!;
  const points =
    hasValue(last.side1PointScore) || hasValue(last.side2PointScore)
      ? ` (${last.side1PointScore ?? 0}-${last.side2PointScore ?? 0})`
      : '';
  return `${games}${points}`;
}

/**
 * Return the matchUps with each un-officially-scored, live-tracked one replaced
 * by a display copy carrying the live score as IN_PROGRESS. Untracked or
 * officially scored matchUps are returned as the same objects.
 */
export function overlayLiveScores<T extends { matchUpId?: string }>(
  matchUps: T[],
  getLive: (matchUpId: string | undefined) => LiveTrackedEntry | undefined,
): T[] {
  return matchUps.map((matchUp: any) => {
    const live = getLive(matchUp?.matchUpId);
    if (!live?.score || hasOfficialScore(matchUp)) return matchUp;
    return {
      ...matchUp,
      matchUpStatus: 'IN_PROGRESS',
      score: { ...live.score, sets: live.score.sets.map((s) => ({ ...s })) },
      liveTracked: true,
    };
  });
}
