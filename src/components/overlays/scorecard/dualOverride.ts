/**
 * A TEAM dual's issues and its team score set by hand, for the scorecard.
 *
 * - The issues are the factory's (`getDualIssues`): the scorecard marks the lines and shows the dual's own in a banner.
 * - Override: the team score typed in the scorecard header is recorded with automatic team scoring off, so lines scored
 *   later do not change it.
 * - Restore: automatic team scoring back on; the factory recalculates the dual from its lines.
 * - A dual decided with lines unplayed: those lines recorded as dead rubbers.
 *
 * Lives in its own module so it can be tested without importing the overlay, which pulls courthive-components.
 */
import { ENABLE_TIE_AUTO_CALC, SET_MATCHUP_STATUS } from 'constants/mutationConstants';
import { matchUpStatusConstants } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';

const { DEAD_RUBBER } = matchUpStatusConstants;

export type TeamScore = { side1Score: number; side2Score: number; winningSide?: number };

export function dualIssues({ drawId, matchUpId }: { drawId: string; matchUpId: string }): any[] {
  return tournamentEngine.getDualIssues({ drawId, matchUpId })?.issues ?? [];
}

export function overrideTeamScoreMethod({
  teamScore,
  matchUpId,
  drawId,
}: {
  teamScore: TeamScore;
  matchUpId: string;
  drawId: string;
}): any {
  const { side1Score, side2Score, winningSide } = teamScore;
  const score = {
    sets: [{ setNumber: 1, side1Score, side2Score, winningSide }],
    scoreStringSide1: `${side1Score}-${side2Score}`,
    scoreStringSide2: `${side2Score}-${side1Score}`,
  };
  return {
    params: { drawId, matchUpId, outcome: { score, winningSide }, disableAutoCalc: true },
    method: SET_MATCHUP_STATUS,
  };
}

export function restoreAutoCalcMethod({ drawId, matchUpId }: { drawId: string; matchUpId: string }): any {
  return { method: ENABLE_TIE_AUTO_CALC, params: { drawId, matchUpId } };
}

export function deadRubberMethods({ drawId, matchUpIds = [] }: { drawId: string; matchUpIds?: string[] }): any[] {
  return matchUpIds.map((matchUpId) => ({
    params: { drawId, matchUpId, outcome: { matchUpStatus: DEAD_RUBBER } },
    method: SET_MATCHUP_STATUS,
  }));
}
