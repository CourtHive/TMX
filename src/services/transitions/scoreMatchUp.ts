/**
 * Enter matchUp score with V2 scoring modal (dynamicSets approach).
 * Handles score submission, parsing, and mutation with callback propagation.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { closeModal } from 'components/modals/baseModal/baseModal';
import { scoringModalV2 } from 'components/modals/scoringV2';
import { tournamentEngine } from 'tods-competition-factory';
import { isFunction } from 'functions/typeOf';

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

  // Always use V2 scoring modal (dynamicSets is now the default approach)
  // Legacy scoringModal and scoreBoard are deprecated
  scoringModalV2({ matchUp, callback: scoreSubmitted });
}
