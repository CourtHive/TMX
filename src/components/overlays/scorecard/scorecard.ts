/**
 * Scorecard overlay for team match display and editing.
 * Uses renderScorecard from courthive-components for the layout,
 * wires TMX-specific event handlers for scoring and substitution.
 */
import { renderScorecard as renderScorecardLayout, updateTieScore, compositions } from 'courthive-components';
import { participantMatchUpActions } from 'components/popovers/participantMatchUpActions';
import { tournamentEngine, extensionConstants } from 'tods-competition-factory';
import { closeOverlay, openOverlay, setOverlayContent } from '../overlay';
import { updateTieFormat } from '../editTieFormat.js/updateTieFormat';
import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { displayConfig } from 'config/displayConfig';
import { isFunction } from 'functions/typeOf';

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

  const composition = compositions[compositionName] || displayConfig.get().composition || compositions['National'];

  if (configuration) {
    composition.configuration ??= {};
    Object.assign(composition.configuration, configuration);
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

function refreshScorecard({ drawId, matchUpId }: { drawId: string; matchUpId: string }): void {
  const matchUp = tournamentEngine.findMatchUp({
    drawId,
    matchUpId,
    participantsProfile: { withISO2: true },
  })?.matchUp;
  if (!matchUp) return;

  const content = renderScorecard({ matchUp, onRefresh: () => refreshScorecard({ drawId, matchUpId }) });
  setOverlayContent({ content });
}

export function renderScorecard({
  matchUp,
  composition: compositionOverride,
  onRefresh,
}: {
  matchUp: any;
  composition?: any;
  onRefresh?: () => void;
}): HTMLDivElement {
  const composition = compositionOverride || resolveComposition(matchUp);
  const eventHandlers = buildCollectionEventHandlers({ matchUp, onRefresh });

  const container = renderScorecardLayout({ matchUp, composition, eventHandlers });
  container.classList.add('overlay-content-container');

  return container;
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
  footer.appendChild(clear);
  footer.appendChild(close);

  return footer;
}
