/**
 * Turn a live-tracked score into something a TD can read: a compact string for
 * table cells, and a display-only matchUp overlay for the bracket renderer.
 *
 * A live score is unofficial. It is shown only while the matchUp carries no
 * official result, it never sets the matchUp's `winningSide`, and the overlay
 * is a copy: the engine's matchUp — which every scoring click resolves by id —
 * is never touched.
 *
 * Two sources feed it: a tracker on the relay's /tracker → /live path, and a
 * crowd session the TD promoted. The tracker wins when both exist — it is pushed
 * per point, where the crowd score arrives on the next poll.
 */
import type { LiveScore, LiveSet, LiveTrackedEntry } from './liveTrackedScores';
import type { TrustedCrowdScore } from 'services/crowd/crowdActivityIndex';
import { sanitizeLiveScore } from './liveTrackedScores';

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

type Side = 1 | 2;

function formatSet(set: LiveSet, first: Side): string {
  const second: Side = first === 1 ? 2 : 1;
  const mine = set[`side${first}Score`] ?? 0;
  const theirs = set[`side${second}Score`] ?? 0;
  const games = `${mine}-${theirs}`;
  const tbMine = set[`side${first}TiebreakScore`];
  const tbTheirs = set[`side${second}TiebreakScore`];
  if (!hasValue(tbMine) && !hasValue(tbTheirs)) return games;
  const loserTb = mine > theirs ? tbTheirs : tbMine;
  return `${games}(${loserTb ?? 0})`;
}

/**
 * Compact string from one side's perspective (side 1 by default), e.g.
 * `6-3 2-1 (30-15)`. Game points come from the last set when the producer sent
 * them. Falls back to the producer's own string when it sent no sets.
 */
export function formatLiveScore(score: LiveScore | undefined, perspective: Side = 1): string {
  if (!score) return '';
  const sets = score.sets ?? [];
  if (!sets.length) return (perspective === 1 ? score.scoreStringSide1 : score.scoreStringSide2) ?? '';
  const other: Side = perspective === 1 ? 2 : 1;
  const games = sets.map((set) => formatSet(set, perspective)).join(' ');
  const last = sets.at(-1)!;
  const mine = last[`side${perspective}PointScore`];
  const theirs = last[`side${other}PointScore`];
  const points = hasValue(mine) || hasValue(theirs) ? ` (${mine ?? 0}-${theirs ?? 0})` : '';
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
  return matchUps.map((matchUp) => withLiveScore(matchUp, getLive));
}

/**
 * One matchUp: a display copy carrying its live score as IN_PROGRESS — with the
 * side strings that renderers which show a string (the schedule grid cell) read —
 * or the same object when it is untracked or officially scored.
 */
export function withLiveScore<T>(
  matchUp: T,
  getLive: (matchUpId: string | undefined) => LiveTrackedEntry | undefined,
): T {
  const m: any = matchUp;
  const live = getLive(m?.matchUpId);
  if (!live?.score || hasOfficialScore(m)) return matchUp;
  return {
    ...m,
    matchUpStatus: 'IN_PROGRESS',
    score: {
      sets: live.score.sets.map((s) => ({ ...s })),
      scoreStringSide1: formatLiveScore(live.score, 1),
      scoreStringSide2: formatLiveScore(live.score, 2),
    },
    liveTracked: true,
  };
}

/** The score to show live for a matchUp: its tracker's, else its promoted crowd session's. */
export function pickLiveScore(
  tracker: LiveTrackedEntry | undefined,
  trustedCrowd: TrustedCrowdScore | undefined,
): LiveTrackedEntry | undefined {
  if (tracker?.score || !trustedCrowd) return tracker;
  const score = sanitizeLiveScore(trustedCrowd?.currentScore);
  if (!score) return tracker;
  return { lastSeenAt: trustedCrowd?.updatedAt ?? '', score };
}
