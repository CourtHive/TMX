import { tournamentEngine } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { closeModal } from 'components/modals/baseModal/baseModal';
import { scoreBoard } from 'legacy/scoring/scoreBoard';
import { isFunction } from 'functions/typeOf';
import { env } from 'settings/env';

import { SET_MATCHUP_STATUS } from 'constants/mutationConstants';

export function enterMatchUpScore({ matchUpId, callback }) {
  const { matchUp } = tournamentEngine.findMatchUp({ matchUpId });

  const scoreSubmitted = (outcome) => {
    const { matchUpStatus, winningSide, score } = outcome;
    const sets = score && tournamentEngine.parseScoreString({ scoreString: score });
    console.log({ sets });
    const methods = [
      {
        method: SET_MATCHUP_STATUS,
        params: {
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
  scoreBoard.setMatchScore({
    delegation: env.scoring.delegation,
    round_name: matchUp.roundName || '',
    matchFormat: matchUp.matchUpFormat,
    callback: scoreSubmitted,
    muid: matchUp.matchUpId,
    existing_scores,
    teams,
  });
}
