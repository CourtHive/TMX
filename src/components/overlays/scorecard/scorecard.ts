/**
 * Scorecard overlay for team match display and editing.
 * Uses renderScorecard from courthive-components for the layout,
 * wires TMX-specific event handlers for scoring and substitution.
 */
import { deadRubberMethods, dualIssues, overrideTeamScoreMethod, restoreAutoCalcMethod } from './dualOverride';
import { renderScorecard as renderScorecardLayout, updateTieScore, compositions } from 'courthive-components';
import { participantMatchUpActions } from 'components/popovers/participantMatchUpActions';
import { resolveCompositionByName } from 'services/compositions/resolveCompositionByName';
import { finishingOrderCollections, saveFinishingOrder } from './orderOfFinish';
import { closeOverlay, openOverlay, setOverlayContent } from '../overlay';
import { updateTieFormat } from '../editTieFormat.js/updateTieFormat';
import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { extensionConstants } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import { tipster } from 'components/popovers/tipster';
import { displayConfig } from 'config/displayConfig';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

// constants
import { RESET_MATCHUP_LINEUPS, RESET_SCORECARD, SET_MATCHUP_STATUS } from 'constants/mutationConstants';

function resolveComposition(matchUp: any): any {
  const { drawId, eventId } = matchUp;
  const storedValue = tournamentEngine.findExtension({
    name: extensionConstants.DISPLAY,
    discover: true,
    eventId,
    drawId,
  })?.extension?.value;

  const display = storedValue?.admin ?? storedValue;
  const compositionName = display?.compositionName;
  const configuration = display?.configuration;

  const composition =
    resolveCompositionByName(compositionName) || displayConfig.get().composition || compositions['National'];

  if (configuration) {
    composition.configuration ??= {};
    Object.assign(composition.configuration, configuration);
  }

  // Display extension may carry a colors snapshot (saved when the user
  // applied a custom composition). Extension colors win over resolver
  // defaults so display state survives later edits to the underlying
  // user composition.
  if (display?.colors) {
    composition.colors = { ...display.colors };
  }

  return composition;
}

interface ScorecardParams {
  title: string;
  drawId: string;
  matchUpId: string;
  onClose?: () => void;
}

export function openScorecard({ title, drawId, matchUpId, onClose }: ScorecardParams): any {
  const result = tournamentEngine.findMatchUp({ drawId, matchUpId, participantsProfile: { withISO2: true } });
  const matchUp = result.matchUp;

  if (!matchUp || result.error) return;
  if (!title || !Array.isArray(matchUp?.tieFormat?.collectionDefinitions)) return;

  const content = renderScorecard({ matchUp, onRefresh: () => refreshScorecard({ drawId, matchUpId }) });
  const footer = renderScorecardFooter({ title, drawId, matchUpId, onClose });

  return openOverlay({ title, content, footer });
}

type RefreshParams = { drawId: string; matchUpId: string; editingCollectionId?: string };

// the collection whose order of finish is being corrected is the only state the scorecard keeps between renders
function refreshScorecard({ drawId, matchUpId, editingCollectionId }: RefreshParams): void {
  const matchUp = tournamentEngine.findMatchUp({
    drawId,
    matchUpId,
    participantsProfile: { withISO2: true },
  })?.matchUp;
  if (!matchUp) return;

  const content = renderScorecard({
    onRefresh: () => refreshScorecard({ drawId, matchUpId }),
    editingCollectionId,
    matchUp,
  });
  setOverlayContent({ content });
}

export function renderScorecard({
  matchUp,
  composition: compositionOverride,
  editingCollectionId,
  onRefresh,
}: {
  matchUp: any;
  composition?: any;
  editingCollectionId?: string;
  onRefresh?: () => void;
}): HTMLDivElement {
  const composition = compositionOverride || resolveComposition(matchUp);
  const eventHandlers = buildCollectionEventHandlers({ matchUp, onRefresh });

  const { drawId, matchUpId } = matchUp;
  const send = (methods: any[]) => mutationRequest({ methods, callback: () => onRefresh?.() });
  const issueActions = {
    DUAL_DECIDED: {
      label: t('overlays.scorecard.recordDeadRubbers'),
      onClick: ({ matchUpIds }: any) => send(deadRubberMethods({ drawId, matchUpIds })),
    },
  };
  const teamScore = {
    onOverride: (score: any) => send([overrideTeamScoreMethod({ drawId, matchUpId, teamScore: score })]),
    onRestore: () => send([restoreAutoCalcMethod({ drawId, matchUpId })]),
  };

  // the collection card's order-of-finish entry mode: Save sends the whole order, Cancel leaves it as it was
  const finishingOrder = {
    // resolves to whether the server accepted it: on a refusal the card keeps the edits and offers Save again
    onSave: (order: any[]) =>
      saveFinishingOrder({
        notify: (success) =>
          tmxToast({
            message: t(success ? 'overlays.scorecard.orderOfFinishSaved' : 'overlays.scorecard.orderOfFinishFailed'),
            intent: success ? 'is-success' : 'is-danger',
          }),
        send: mutationRequest,
        finishingOrder: order,
        onRefresh,
        drawId,
      }),
    onCancel: () => onRefresh?.(),
    editingCollectionId,
  };

  const container = renderScorecardLayout({
    issues: dualIssues({ drawId, matchUpId }),
    finishingOrder,
    labels: scorecardLabels(),
    eventHandlers,
    issueActions,
    composition,
    teamScore,
    matchUp,
  });
  container.classList.add('overlay-content-container');

  return container;
}

function scorecardLabels(): any {
  return {
    issues: {
      LINEUP_INCOMPLETE: t('overlays.scorecard.issues.LINEUP_INCOMPLETE'),
      DUPLICATE_IN_COLLECTION: t('overlays.scorecard.issues.DUPLICATE_IN_COLLECTION'),
      INELIGIBLE_GENDER: t('overlays.scorecard.issues.INELIGIBLE_GENDER'),
      INELIGIBLE_CATEGORY: t('overlays.scorecard.issues.INELIGIBLE_CATEGORY'),
      SCORE_INCOMPLETE: t('overlays.scorecard.issues.SCORE_INCOMPLETE'),
      MISSING_REASON: t('overlays.scorecard.issues.MISSING_REASON'),
      DUAL_DECIDED: t('overlays.scorecard.issues.DUAL_DECIDED'),
      MANUAL_SCORE: t('overlays.scorecard.issues.MANUAL_SCORE'),
      MANUAL_SCORE_DIVERGES: t('overlays.scorecard.issues.MANUAL_SCORE_DIVERGES'),
    },
    orderOfFinish: t('overlays.scorecard.orderOfFinish'),
    issueCount: t('overlays.scorecard.issueCount'),
    override: t('overlays.scorecard.overrideScore'),
    restore: t('overlays.scorecard.restoreAutoScore'),
    manual: t('overlays.scorecard.manualScore'),
    winner: t('overlays.scorecard.winner'),
    cancel: t('common.cancel'),
    save: t('common.save'),
  };
}

function buildCollectionEventHandlers({ matchUp, onRefresh }: { matchUp: any; onRefresh?: () => void }): any {
  const { drawId } = matchUp;

  const getMatchUpFromEvent = (pointerEvent: any) => {
    let el = pointerEvent.target as HTMLElement;
    while (el && !el.classList?.contains('tmx-m')) el = el.parentElement as HTMLElement;
    const muId = el?.getAttribute('id');
    if (!muId) return undefined;
    return matchUp.tieMatchUps?.find((m: any) => m.matchUpId === muId);
  };

  const getSideNumber = (pointerEvent: any) => {
    let el = pointerEvent.target as HTMLElement;
    while (el && !el.classList?.contains('tmx-sd')) el = el.parentElement as HTMLElement;
    return Number.parseInt(el?.getAttribute('sideNumber') || '0');
  };

  const scoreClick = (props: any) => {
    const tieMatchUp = getMatchUpFromEvent(props.pointerEvent);
    if (!tieMatchUp) return;

    const { validActions } =
      tournamentEngine.matchUpActions({
        matchUpId: tieMatchUp.matchUpId,
        drawId,
      }) || {};

    const readyToScore = validActions?.find(({ type }: any) => type === 'SCORE');
    if (readyToScore) {
      enterMatchUpScore({
        matchUpId: tieMatchUp.matchUpId,
        callback: (result: any) => {
          if (result.success) {
            const tieResult = result.results?.find(
              ({ methodName }: any) => methodName === SET_MATCHUP_STATUS,
            )?.tieMatchUpResult;
            if (tieResult) updateTieScore(tieResult);
            // the factory numbers the line in its collection's order of finish; the refresh shows it
            onRefresh?.();
          }
        },
      });
    }
  };

  const participantClick = (props: any) => {
    const tieMatchUp = getMatchUpFromEvent(props.pointerEvent);
    if (!tieMatchUp) return;

    const sideNumber = getSideNumber(props.pointerEvent);
    if (!sideNumber) return;

    const { validActions } =
      tournamentEngine.matchUpActions({
        matchUpId: tieMatchUp.matchUpId,
        drawId,
        sideNumber,
        policyDefinitions: {
          matchUpActions: {
            substituteAfterCompleted: true,
            substituteWithoutScore: true,
          },
        },
      }) || {};

    if (!validActions?.length) return;

    const matchUpData = {
      matchUpId: tieMatchUp.matchUpId,
      matchUpType: tieMatchUp.matchUpType,
      eventType: 'TEAM',
      matchUp: tieMatchUp,
      drawId,
    };

    const fakeCell = {
      getRow: () => ({
        getData: () => matchUpData,
      }),
      getColumn: () => ({
        getDefinition: () => ({ field: `side${sideNumber}` }),
      }),
    };

    const callback = (result: any) => {
      if (result.success) onRefresh?.();
    };

    participantMatchUpActions(props.pointerEvent, fakeCell, callback, {
      individualParticipant: props.individualParticipant,
    });
  };

  return {
    participantClick,
    matchUpClick: scoreClick,
    scoreClick,
  };
}

export function renderScorecardFooter({ title, drawId, matchUpId, onClose }: ScorecardParams): HTMLDivElement {
  const edit = document.createElement('button');
  edit.className = 'button is-warning is-light';
  edit.onclick = () => {
    const callback = () => openScorecard({ title, drawId, matchUpId, onClose });
    updateTieFormat({ matchUpId, drawId, callback });
  };
  edit.innerHTML = 'Edit scorecard';

  const postMutation = () => refreshScorecard({ drawId, matchUpId });

  const removePlayers = document.createElement('button');
  removePlayers.className = 'button is-warning is-light button-spacer';
  removePlayers.innerHTML = 'Remove players';
  removePlayers.onclick = () => {
    const methods = [
      {
        params: { drawId, matchUpId, inheritance: false },
        method: RESET_MATCHUP_LINEUPS,
      },
    ];
    mutationRequest({ methods, callback: postMutation });
  };

  const orderOfFinish = document.createElement('button');
  orderOfFinish.className = 'button is-info is-light button-spacer';
  const orderOfFinishLabel = t('overlays.scorecard.orderOfFinish');
  orderOfFinish.textContent = orderOfFinishLabel;
  orderOfFinish.onclick = () => {
    const dual = tournamentEngine.findMatchUp({ drawId, matchUpId })?.matchUp;
    const collections = finishingOrderCollections(dual);
    const edit = (editingCollectionId: string) => refreshScorecard({ drawId, matchUpId, editingCollectionId });
    if (!collections.length) {
      tmxToast({ message: t('overlays.scorecard.noLinesToOrder'), intent: 'is-warning' });
    } else if (collections.length === 1) {
      edit(collections[0].collectionId);
    } else {
      const options = collections.map(({ collectionId, collectionName }) => ({
        option: collectionName ?? collectionId,
        onClick: () => edit(collectionId),
      }));
      tipster({
        options,
        target: orderOfFinish,
        title: orderOfFinishLabel,
        config: { arrow: false },
      });
    }
  };

  const clear = document.createElement('button');
  clear.className = 'button is-info is-light button-spacer';
  clear.innerHTML = 'Clear results';
  clear.onclick = () => {
    const methods = [
      {
        params: { drawId, matchUpId },
        method: RESET_SCORECARD,
      },
    ];
    mutationRequest({ methods, callback: postMutation });
  };

  const close = document.createElement('button');
  close.className = 'button is-info button-spacer';
  close.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeOverlay();
    isFunction(onClose) && onClose?.();
  };
  close.innerHTML = 'Done';

  const footer = document.createElement('div');
  footer.className = 'overlay-footer-wrap';
  footer.appendChild(edit);
  footer.appendChild(removePlayers);
  footer.appendChild(orderOfFinish);
  footer.appendChild(clear);
  footer.appendChild(close);

  return footer;
}
