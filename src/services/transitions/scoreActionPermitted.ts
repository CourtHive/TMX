import { tournamentEngine } from 'services/factory/engine';

/** Scoring and removing a recorded result are separate factory permissions. */
export function scoreActionPermitted(matchUp: { drawId?: string; matchUpId?: string }): boolean {
  const { drawId, matchUpId } = matchUp;
  if (!drawId || !matchUpId) return false;
  const { validActions } = tournamentEngine.matchUpActions({ drawId, matchUpId });
  return !!validActions?.some(({ type }) => type === 'SCORE');
}
