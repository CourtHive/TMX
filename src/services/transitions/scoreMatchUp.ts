/**
 * Enter matchUp score with scoring modal.
 * Handles score submission, parsing, and mutation with callback propagation.
 */
import { subscribeToMatchUp, unsubscribeFromMatchUp } from 'services/messaging/scoreRelay';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { closeModal } from 'components/modals/baseModal/baseModal';
import { scoringModal } from 'components/modals/scoringV2';
import { tournamentEngine } from 'tods-competition-factory';
import { isFunction } from 'functions/typeOf';

import { SET_MATCHUP_STATUS } from 'constants/mutationConstants';

export function enterMatchUpScore(params: {
  matchUpId: string;
  matchUp?: any;
  callback?: (result: any) => void;
}): void {
  const { matchUpId, callback } = params;
  const participantsProfile = { withScaleValues: true };
  const matchUp = params.matchUp ?? tournamentEngine.findMatchUp({ participantsProfile, matchUpId }).matchUp;

  // Subscribe to relay for live score updates from other trackers
  subscribeToMatchUp(matchUpId, (data: any) => {
    updateScoringDialogPreview(data);
  });

  const onRelayCleanup = () => unsubscribeFromMatchUp(matchUpId);

  const scoreSubmitted = (outcome: any) => {
    const { matchUpStatus, matchUpFormat, winningSide, score, sets: outcomeSets } = outcome;

    // Use sets directly from outcome if available (e.g., from dialPad/dynamicSets with irregular endings)
    // Otherwise parse the score string (e.g., from freeScore)
    let sets = outcomeSets || [];
    if (!sets.length && score) {
      const parsedSets = tournamentEngine.parseScoreString({ scoreString: score });
      sets = parsedSets || [];
    }

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
      isFunction(callback) && callback({ ...result, outcome });
    };
    mutationRequest({ methods, callback: mutationCallback });
  };

  scoringModal({ matchUp, callback: scoreSubmitted, onRelayCleanup });
}

/**
 * Update the renderMatchUp preview at the top of the scoring dialog
 * with live score data from the relay. Does NOT touch score inputs.
 */
function updateScoringDialogPreview(_data: any): void {
  // The scoring approaches create a div (first child of .cModal-body content)
  // that contains the renderMatchUp preview. Find the score elements and pulse them.
  const modal = document.querySelector('.cModal');
  if (!modal) return;

  // Find the matchUp container — it's the first div child of the approach container
  const approachContainer = modal.querySelector('.cModal-body > div');
  if (!approachContainer) return;

  const matchUpContainer = approachContainer.firstElementChild as HTMLElement;
  if (!matchUpContainer) return;

  // Add pulse to the matchUp preview
  matchUpContainer.classList.add('live-score-pulse');
  setTimeout(() => matchUpContainer.classList.remove('live-score-pulse'), 3000);
}
