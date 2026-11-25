/**
 * A TEAM dual's issues and its team score set by hand, for the scorecard.
 *
 * - The issues are the factory's (`getDualIssues`): the scorecard marks the lines and shows the dual's own in a banner.
 * - Override: the team score typed in the scorecard header is recorded with automatic team scoring off, so lines scored
 *   later do not change it. A winner on a level score is recorded with how it was decided (`score.overtime`,
 *   `decidedIn: 'EXTERNAL'`): the factory refuses one without it (TEAM results item 3, CA 2026-11-07).
 * - Restore: automatic team scoring back on; the factory recalculates the dual from its lines.
 * - A dual decided with lines unplayed: those lines recorded as dead rubbers.
 *
 * Lives in its own module so it can be tested without importing the overlay, which pulls courthive-components.
 */
import { ENABLE_TIE_AUTO_CALC, SET_MATCHUP_STATUS } from 'constants/mutationConstants';
import { matchUpStatusConstants } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';

const { COMPLETED, DEAD_RUBBER } = matchUpStatusConstants;

export type DecisionMethod = 'SHOOTOUT' | 'COMPETITION_RULE' | 'LOTS' | 'OFFICIAL_DECISION';
export const DECISION_METHODS: DecisionMethod[] = ['SHOOTOUT', 'COMPETITION_RULE', 'LOTS', 'OFFICIAL_DECISION'];
/** `decidedBy` comes with a level score only, from the scorecard's decision choice */
export type TeamScore = {
  decidedBy?: { method: DecisionMethod };
  side1Score: number;
  side2Score: number;
  winningSide?: number;
};

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
  const { side1Score, side2Score, winningSide, decidedBy } = teamScore;
  // a decision belongs to a level score only: a score that decides the dual needs none
  const isDecided = !!decidedBy && side1Score === side2Score;
  const decided = isDecided ? { overtime: { decidedIn: 'EXTERNAL', decidedBy } } : {};
  const score = {
    sets: [{ setNumber: 1, side1Score, side2Score, winningSide }],
    scoreStringSide1: `${side1Score}-${side2Score}`,
    scoreStringSide2: `${side2Score}-${side1Score}`,
    ...decided,
  };
  return {
    // a decided result is COMPLETED: the factory stamps the record's display string only then
    params: {
      outcome: { score, winningSide, ...(isDecided ? { matchUpStatus: COMPLETED } : {}) },
      disableAutoCalc: true,
      matchUpId,
      drawId,
    },
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
