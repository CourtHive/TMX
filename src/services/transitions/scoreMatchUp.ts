/**
 * Enter matchUp score with scoring modal.
 * Handles score submission, parsing, and mutation with callback propagation.
 */
import { subscribeToMatchUp, unsubscribeFromMatchUp } from 'services/messaging/scoreRelay';
import { persistConfigToStorage } from 'services/settings/settingsStorage';
import { clearPermitted, isClearingOutcome } from './clearScorePermission';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { closeModal } from 'components/modals/baseModal/baseModal';
import { preferencesConfig } from 'config/preferencesConfig';
import { openScoreEntryDialog } from 'courthive-components';
import { tmxToast } from 'services/notifications/tmxToast';
import { scoringModal } from 'components/modals/scoringV2';
import { tournamentEngine } from 'services/factory/engine';
import { policyConstants } from 'tods-competition-factory';
import { featureFlags } from 'config/featureFlags';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';
import {
  setActiveScoring,
  clearActiveScoring,
  activeScoringWasChangedRemotely,
  acknowledgeRemoteScoringChange,
  currentScoreString,
} from 'services/transitions/activeScoringGuard';

import type { ScoreEntryApproach, StatusCodeGroups } from 'courthive-components';

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

  /**
   * Send one `setMatchUpStatus` and report back. Shared by both front ends: the collision guard, the
   * refusal toast and the caller's callback are about the mutation, not about the dialog that built it.
   */
  const dispatch = ({ outcome, onAccepted }: { outcome: any; onAccepted?: () => void }) => {
    // A clear the engine would refuse is stopped here, with the reason, rather than sent to be refused
    // as "No valid actions". Asked at submit time, of the live record, so a later match decided while
    // the dialog was open still counts. Nothing is sent, so the result stands; the score modal stays
    // open as it does for a refused score, while the score entry dialog closes after any submit.
    if (isClearingOutcome(outcome) && !clearPermitted({ matchUp, drawId: matchUp.drawId, matchUpId })) {
      tmxToast({ message: t('toasts.clearRefused'), intent: 'is-warning', pauseOnHover: true });
      return;
    }

    const methods = [
      {
        method: SET_MATCHUP_STATUS,
        params: { allowChangePropagation: true, drawId: matchUp.drawId, outcome, matchUpId },
      },
    ];
    const mutationCallback = (result: any) => {
      if (result?.error) {
        // Surface the rejection (e.g. ERR_INCOMPATIBLE_MATCHUP_STATUS when
        // downstream matchUps are active) instead of silently swallowing it.
        // Keep the modal open so the entered score isn't lost and the user
        // can adjust or cancel.
        // A refused score says WHICH set is wrong in `info` ("Set 1: …"), and the operator needs that
        // more than the generic "Invalid score" — the factory refuses unfinished sets since #5096.
        const message = result.info ?? result.error.message ?? t('common.error');
        tmxToast({ message, intent: 'is-danger' });
      } else {
        onAccepted?.();
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

  // Asked once, as the dialog opens, so it can withhold [Clear] where the engine would refuse it. The
  // check in `dispatch` stays: it asks again at submit, against whatever was decided in the meantime.
  const clearable = clearPermitted({ matchUp, drawId: matchUp.drawId, matchUpId });

  if (featureFlags.get().scoreEntryDialog) {
    openNewScoreEntry({ matchUp, dispatch, onRelayCleanup, clearable });
    return;
  }

  const scoreSubmitted = (outcome: any) => {
    const { matchUpStatus, matchUpFormat, winningSide, score, sets: outcomeSets, matchUpStatusCodes } = outcome;

    // Use sets directly from outcome if available (e.g., from dialPad/dynamicSets with irregular endings)
    // Otherwise parse the score string (e.g., from freeScore)
    let sets = outcomeSets || [];
    if (!sets.length && score) {
      const parsedSets = tournamentEngine.parseScoreString({ scoreString: score });
      sets = parsedSets || [];
    }

    dispatch({
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
      onAccepted: closeModal,
    });
  };

  scoringModal({
    matchUp,
    callback: scoreSubmitted,
    onRelayCleanup,
    matchUpStatusCodes: resolveStatusCodeGroups(matchUp),
    clearable,
  });
}

const DIALOG_APPROACHES: ScoreEntryApproach[] = ['dynamicSets', 'dialPad', 'freeScore'];

/**
 * The beta front end: courthive-components' `openScoreEntryDialog`.
 *
 * The dialog reports an engine-ready `outcome` (`score.sets`, positional `matchUpStatusCodes`, the clear
 * shape, a changed `matchUpFormat`), so there is nothing to translate here — it goes to `dispatch` as it
 * is. A COPY, because `setMatchUpStatus` writes its derived score strings into the outcome it is handed
 * and the local apply would otherwise alter what the server was sent. Side names come from the
 * in-context matchUp; the dialog wants display names, not participants.
 */
function openNewScoreEntry({
  matchUp,
  dispatch,
  onRelayCleanup,
  clearable,
}: {
  matchUp: any;
  dispatch: (params: { outcome: any; onAccepted?: () => void }) => void;
  onRelayCleanup: () => void;
  clearable: boolean;
}): void {
  const preferred = preferencesConfig.get().scoringApproach as ScoreEntryApproach;
  openScoreEntryDialog({
    matchUp,
    sides: dialogSides(matchUp),
    context: [matchUp?.roundName, matchUp?.schedule?.courtName].filter(Boolean).join(' · ') || undefined,
    statusCodeGroups: resolveStatusCodeGroups(matchUp),
    clearable,
    approach: DIALOG_APPROACHES.includes(preferred) ? preferred : undefined,
    onApproachChange: (scoringApproach) => {
      preferencesConfig.set({ scoringApproach });
      persistConfigToStorage();
    },
    // Present so the format chip is a control; the chosen format rides on `outcome.matchUpFormat`.
    onFormatChange: () => undefined,
    onScoreDiscarded: ({ discarded, matchUpFormat }) => {
      const sets = discarded.map((set) => `${set.side1Score ?? ''}-${set.side2Score ?? ''}`).join(', ');
      tmxToast({
        message: t('toasts.scoreDiscardedByFormat', { matchUpFormat, count: discarded.length, sets }),
        intent: 'is-warning',
      });
    },
    onClose: onRelayCleanup,
    onSubmit: ({ outcome }) => dispatch({ outcome: structuredClone(outcome) }),
  });
}

/** Display names and seeds for the dialog's two rows, from an in-context matchUp. */
export function dialogSides(
  matchUp: any,
): [{ participantName: string; seed?: string }, { participantName: string; seed?: string }] {
  const sideFor = (sideNumber: number) => {
    const side = matchUp?.sides?.find((s: any) => s.sideNumber === sideNumber) ?? matchUp?.sides?.[sideNumber - 1];
    const participantName = side?.participant?.participantName ?? (side?.bye ? 'BYE' : '');
    const seed = side?.seedValue ? String(side.seedValue) : undefined;
    return seed ? { participantName, seed } : { participantName };
  };
  return [sideFor(1), sideFor(2)];
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
