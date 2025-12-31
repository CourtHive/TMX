/**
 * Enter matchUp score with modal or legacy scoreBoard.
 * Handles score submission, parsing, and mutation with callback propagation.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { closeModal } from 'components/modals/baseModal/baseModal';
import { scoringModal } from 'components/modals/scoringModal';
import { scoringModalV2 } from 'components/modals/scoringV2';
import { tournamentEngine } from 'tods-competition-factory';
import { scoreBoard } from 'legacy/scoring/scoreBoard';
import { isFunction } from 'functions/typeOf';
import { env } from 'settings/env';

import { SET_MATCHUP_STATUS } from 'constants/mutationConstants';

export function enterMatchUpScore(params: { matchUpId: string; matchUp?: any; callback?: (result: any) => void }): void {
  const { matchUpId, callback } = params;
  const participantsProfile = { withScaleValues: true };
  const matchUp = params.matchUp ?? tournamentEngine.findMatchUp({ participantsProfile, matchUpId }).matchUp;

  const scoreSubmitted = (outcome: any) => {
    const { matchUpStatus, matchUpFormat, winningSide, score } = outcome;
    const parsedSets = score && tournamentEngine.parseScoreString({ scoreString: score });
    const sets = parsedSets || [];
    const methods = [
      {
        method: SET_MATCHUP_STATUS,
        params: {
          allowChangePropagation: true,
          drawId: matchUp.drawId,
          outcome: {
            score: { sets },
            matchUpFormat,
            matchUpStatus,
            winningSide,
          },
          matchUpId,
        },
      },
    ];
    const mutationCallback = (result: any) => {
      closeModal();
      isFunction(callback) && callback && callback({ ...result, outcome });
    };
    mutationRequest({ methods, callback: mutationCallback });
  };

  const teams = matchUp.sides.map((side: any) => side.participant);
  const existing_scores = matchUp.score?.sets || [];

  if (env.scoringV2) {
    // New TypeScript scoring modal (V2)
    scoringModalV2({ matchUp, callback: scoreSubmitted });
  } else if (env.scoring) {
    // Current TypeScript scoring modal (V1)
    scoringModal({ matchUp, callback: scoreSubmitted });
  } else {
    // Legacy JavaScript scoreBoard
    scoreBoard.setMatchScore({
      round_name: matchUp.roundName || '',
      matchFormat: matchUp.matchUpFormat,
      callback: scoreSubmitted,
      muid: matchUp.matchUpId,
      existing_scores,
      teams,
    });
  }
}
