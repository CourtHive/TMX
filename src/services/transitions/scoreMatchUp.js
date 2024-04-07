import { mutationRequest } from 'services/mutation/mutationRequest';
import { closeModal } from 'components/modals/baseModal/baseModal';
import { scoringModal } from 'components/modals/scoringModal';
import { tournamentEngine } from 'tods-competition-factory';
import { scoreBoard } from 'legacy/scoring/scoreBoard';
import { isFunction } from 'functions/typeOf';
import { env } from 'settings/env';

import { SET_MATCHUP_STATUS } from 'constants/mutationConstants';

export function enterMatchUpScore(params) {
  const { matchUpId, callback } = params;
  const participantsProfile = { withScaleValues: true };
  const matchUp = params.matchUp ?? tournamentEngine.findMatchUp({ participantsProfile, matchUpId }).matchUp;

  const scoreSubmitted = (outcome) => {
    const { matchUpStatus, winningSide, score } = outcome;
    const sets = score && tournamentEngine.parseScoreString({ scoreString: score });
    const methods = [
      {
        method: SET_MATCHUP_STATUS,
        params: {
          allowChangePropagation: true,
          drawId: matchUp.drawId,
          outcome: {
            score: { sets },
            matchUpStatus,
            winningSide,
          },
          matchUpId,
        },
      },
    ];
    const mutationCallback = (result) => {
      closeModal();
      isFunction(callback) && callback({ ...result, outcome });
    };
    mutationRequest({ methods, callback: mutationCallback });
  };

  const teams = matchUp.sides.map((side) => side.participant);
  const existing_scores = matchUp.score?.sets || [];

  if (env.scoring) {
    scoringModal({ matchUp, callback: scoreSubmitted });
  } else {
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
