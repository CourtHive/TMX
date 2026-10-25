/**
 * Enter a matchUp score through courthive-components' score-entry dialog.
 * Handles score submission and mutation with callback propagation.
 */
import { subscribeToMatchUp, unsubscribeFromMatchUp } from 'services/messaging/scoreRelay';
import { getScoreEntryLabels } from 'components/modals/scoringV2/scoringLabels';
import { persistConfigToStorage } from 'services/settings/settingsStorage';
import { clearPermitted, isClearingOutcome } from './clearScorePermission';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { preferencesConfig } from 'config/preferencesConfig';
import { openScoreEntryDialog } from 'courthive-components';
import { tmxToast } from 'services/notifications/tmxToast';
import { tournamentEngine } from 'services/factory/engine';
import { policyConstants } from 'tods-competition-factory';
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

const WARNING_INTENT = 'is-warning';

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

/** The engine owns status scope; absence of metadata retains older factory behaviour. */
function resolveDisabledMatchUpStatuses(matchUp: any, matchUpId: string): string[] | undefined {
  const actions = tournamentEngine.matchUpActions({ drawId: matchUp.drawId, matchUpId });
  return actions.validActions?.find(({ type }) => type === 'SCORE')?.disabledMatchUpStatuses;
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
      tmxToast({ message: t('toasts.clearRefused'), intent: WARNING_INTENT, pauseOnHover: true });
      return;
    }

    const disabledStatuses = resolveDisabledMatchUpStatuses(matchUp, matchUpId);
    if (new Set(disabledStatuses).has(outcome?.matchUpStatus)) {
      tmxToast({
        message: t('toasts.statusOutOfScope'),
        intent: WARNING_INTENT,
        pauseOnHover: true,
      });
      return undefined;
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

  // The dialog may always reset its form. This permission gates submitting an empty replacement;
  // dispatch checks it again at submit, against whatever was decided in the meantime.
  const clearable = clearPermitted({ matchUp, drawId: matchUp.drawId, matchUpId });
  const disabledMatchUpStatuses = resolveDisabledMatchUpStatuses(matchUp, matchUpId);

  openNewScoreEntry({ matchUp, dispatch, onRelayCleanup, clearable, disabledMatchUpStatuses });
}

const DIALOG_APPROACHES: ScoreEntryApproach[] = ['dynamicSets', 'dialPad', 'freeScore'];

/**
 * The score-entry dialog: courthive-components' `openScoreEntryDialog`. It replaced the three separate
 * scoring modals (Dynamic Sets, Dial Pad, Free Score), which now live on as approaches inside it.
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
  disabledMatchUpStatuses,
}: {
  matchUp: any;
  dispatch: (params: { outcome: any; onAccepted?: () => void }) => void;
  onRelayCleanup: () => void;
  clearable: boolean;
  disabledMatchUpStatuses?: string[];
}): void {
  const preferred = preferencesConfig.get().scoringApproach as ScoreEntryApproach;
  openScoreEntryDialog({
    matchUp,
    sides: dialogSides(matchUp),
    context: [matchUp?.roundName, matchUp?.schedule?.courtName].filter(Boolean).join(' · ') || undefined,
    statusCodeGroups: resolveStatusCodeGroups(matchUp),
    labels: getScoreEntryLabels(),
    clearable,
    disabledMatchUpStatuses,
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
        intent: WARNING_INTENT,
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
