import { tournamentEngine, mocksEngine } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { scoreBoard } from 'legacy/scoring/scoreBoard';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';
import { env } from 'settings/env';

import { SET_MATCHUP_STATUS } from 'constants/mutationConstants';

export function enterMatchUpScore({ matchUpId, callback }) {
  const { matchUp } = tournamentEngine.findMatchUp({ matchUpId });

  const scoreSubmitted = (outcome) => {
    const { matchUpStatus, winningSide, score } = outcome;
    const sets = score && mocksEngine.parseScoreString({ scoreString: score });
    const methods = [
      {
        method: SET_MATCHUP_STATUS,
        params: {
          drawId: matchUp.drawId,
          outcome: {
            score: { sets },
            matchUpStatus,
            winningSide
          },
          matchUpId
        }
      }
    ];
    const mutationCallback = (result) => {
      console.log({ outcome, result });
      context.modal.close();
      isFunction(callback) && callback(result);
    };
    mutationRequest({ methods, callback: mutationCallback });
  };

  const teams = matchUp.sides.map((side) => side.participant);
  const existing_scores = matchUp.score?.sets || [];
  scoreBoard.setMatchScore({
    flags: env.scoring.flags && env.assets.flags,
    delegation: env.scoring.delegation,
    round_name: matchUp.roundName || '',
    matchFormat: matchUp.matchUpFormat,
    callback: scoreSubmitted,
    muid: matchUp.matchUpId,
    existing_scores,
    teams
  });
}
