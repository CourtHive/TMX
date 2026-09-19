/**
 * Enter matchUp score with scoring modal.
 * Handles score submission, parsing, and mutation with callback propagation.
 */
import {
  setActiveScoring,
  clearActiveScoring,
  activeScoringWasChangedRemotely,
  acknowledgeRemoteScoringChange,
  currentScoreString,
} from 'services/transitions/activeScoringGuard';
import { subscribeToMatchUp, unsubscribeFromMatchUp } from 'services/messaging/scoreRelay';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { closeModal } from 'components/modals/baseModal/baseModal';
import type { StatusCodeGroups } from 'courthive-components';
import { tmxToast } from 'services/notifications/tmxToast';
import { scoringModal } from 'components/modals/scoringV2';
import { tournamentEngine } from 'services/factory/engine';
import { policyConstants } from 'tods-competition-factory';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

import { SET_MATCHUP_STATUS } from 'constants/mutationConstants';

const { POLICY_TYPE_SCORING } = policyConstants;

/**
 * The reason-code vocabulary for this matchUp's event, or undefined when the tournament has no
 * scoring policy carrying one.
 *
 * TMX ships no built-in vocabulary by design (CA, 2026-09-20): the reason field appears only where
 * a governing body's policy is attached. `undefined` here is therefore the ordinary case, and the
 * modal draws no control for it — not a degraded state to defend against.
 *
 * Event-scoped, because a scoring policy can be attached per event.
 */
function resolveStatusCodeGroups(matchUp: any): StatusCodeGroups | undefined {
  const eventId = matchUp?.eventId;
  if (!eventId) return undefined;

  const scoringPolicy: any = tournamentEngine.findPolicy({ policyType: POLICY_TYPE_SCORING, eventId });
  return scoringPolicy?.policy?.matchUpStatusCodes;
}

export function enterMatchUpScore(params: {
  matchUpId: string;
  matchUp?: any;
  callback?: (result: any) => void;
}): void {
  const { matchUpId, callback } = params;
  const participantsProfile = { withScaleValues: true };
  const matchUp = params.matchUp ?? tournamentEngine.q.matchUp({ participantsProfile, matchUpId });

  // Track the open matchUp so a remote score of it warns instead of being
  // silently clobbered; inject the DOM pulse so the guard stays DOM-free.
  setActiveScoring(matchUpId, () => updateScoringDialogPreview(undefined));

  // Subscribe to relay for live score updates from other trackers
  subscribeToMatchUp(matchUpId, (data: any) => {
    updateScoringDialogPreview(data);
  });

  const onRelayCleanup = () => {
    unsubscribeFromMatchUp(matchUpId);
    // Fires when the modal closes (save, cancel, or dismiss).
    clearActiveScoring(matchUpId);
  };

  const scoreSubmitted = (outcome: any) => {
    const { matchUpStatus, matchUpFormat, winningSide, score, sets: outcomeSets, matchUpStatusCodes } = outcome;

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
            // Only when a reason was actually chosen. The factory reads an EMPTY array as an
            // instruction to blank the codes, so sending `[]` for "no reason given" would erase
            // whatever a previous edit recorded.
            ...(matchUpStatusCodes?.length ? { matchUpStatusCodes } : {}),
          },
          matchUpId,
        },
      },
    ];
    const mutationCallback = (result: any) => {
      if (result?.error) {
        // Surface the rejection (e.g. ERR_INCOMPATIBLE_MATCHUP_STATUS when
        // downstream matchUps are active) instead of silently swallowing it.
        // Keep the modal open so the entered score isn't lost and the user
        // can adjust or cancel.
        tmxToast({ message: result.error.message ?? t('common.error'), intent: 'is-danger' });
      } else {
        closeModal();
      }
      isFunction(callback) && callback({ ...result, outcome });
    };
    const applyScore = () => mutationRequest({ methods, callback: mutationCallback });

    // A remote mutation scored this matchUp while the modal was open. Do NOT
    // silently overwrite the colleague's result — require an explicit confirm
    // that shows their current score. Cancel leaves the modal open so the
    // director can reconsider (or close without saving).
    if (activeScoringWasChangedRemotely()) {
      tmxToast({
        message: t('toasts.overwriteRemoteScore', {
          score: currentScoreString(matchUpId),
          defaultValue: `Another user scored this match ({{score}}). Overwrite with your result?`,
        }),
        intent: 'is-danger',
        pauseOnHover: true,
        duration: 15000,
        action: {
          text: t('overwrite', { defaultValue: 'Overwrite' }),
          onClick: (event?: Event) => {
            event?.stopPropagation?.();
            acknowledgeRemoteScoringChange();
            applyScore();
          },
        },
      });
      return;
    }

    applyScore();
  };

  scoringModal({
    matchUp,
    callback: scoreSubmitted,
    onRelayCleanup,
    matchUpStatusCodes: resolveStatusCodeGroups(matchUp),
  });
}

/**
 * Update the renderMatchUp preview at the top of the scoring dialog
 * with live score data from the relay. Does NOT touch score inputs.
 */
function updateScoringDialogPreview(_data: any): void {
  if (typeof document === 'undefined') return;
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
