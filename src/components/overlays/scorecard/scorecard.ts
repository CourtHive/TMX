/**
 * Scorecard overlay for team match display and editing.
 * Uses renderMatchUp from courthive-components to display collection matchUps as cards.
 */
import { participantMatchUpActions } from 'components/popovers/participantMatchUpActions';
import { getTeamVs, getSideScore, getSide } from 'components/elements/getTeamVs';
import { tournamentEngine, extensionConstants } from 'tods-competition-factory';
import { closeOverlay, openOverlay, setOverlayContent } from '../overlay';
import { updateTieFormat } from '../editTieFormat.js/updateTieFormat';
import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderMatchUp, compositions } from 'courthive-components';
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

const WIN_INDICATOR = 'has-text-success';
const TIE_SIDE_1 = 'tieSide1';
const TIE_SIDE_2 = 'tieSide2';

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
  const contentContainer = document.createElement('div');
  contentContainer.className = 'overlay-content-container sc-container';

  // Team vs team header
  const side1 = getSide({ participantName: getParticipantName({ matchUp, sideNumber: 1 }) || '', justify: 'end' });
  const side2 = getSide({ participantName: getParticipantName({ matchUp, sideNumber: 2 }) || '', justify: 'start' });

  const { winningSide, score } = matchUp;
  const sets = score?.sets || [];
  const side1Score = getSideScore({ winningSide, sets, sideNumber: 1, id: TIE_SIDE_1 });
  const side2Score = getSideScore({ winningSide, sets, sideNumber: 2, id: TIE_SIDE_2 });
  const overview = getTeamVs({ side1, side2, side1Score, side2Score });
  contentContainer.appendChild(overview);

  // Collection panels
  const collectionDefinitions =
    matchUp.tieFormat.collectionDefinitions?.sort((a: any, b: any) => a.collectionOrder - b.collectionOrder) || [];

  const composition = compositionOverride || resolveComposition(matchUp);

  for (const collectionDefinition of collectionDefinitions) {
    const collectionMatchUps = matchUp.tieMatchUps
      .filter((m: any) => m.collectionId === collectionDefinition.collectionId)
      .sort((a: any, b: any) => (a.collectionPosition || 0) - (b.collectionPosition || 0));

    const panel = document.createElement('div');
    panel.className = 'sc-collection-panel';

    // Panel header
    const header = document.createElement('div');
    header.className = 'sc-collection-header';

    const nameEl = document.createElement('div');
    nameEl.className = 'sc-collection-name';
    nameEl.textContent = collectionDefinition.collectionName || 'Collection';

    const meta = document.createElement('div');
    meta.className = 'sc-collection-meta';

    const typeBadge = document.createElement('span');
    const mType = (collectionDefinition.matchUpType || '').toUpperCase();
    typeBadge.className = `tfp-type-badge tfp-type-badge--${mType === 'DOUBLES' ? 'doubles' : 'singles'}`;
    typeBadge.textContent = mType === 'DOUBLES' ? 'D' : 'S';

    const countBadge = document.createElement('span');
    countBadge.className = 'sc-count-badge';
    countBadge.textContent = `${collectionMatchUps.length}`;

    meta.appendChild(typeBadge);
    meta.appendChild(countBadge);
    header.appendChild(nameEl);
    header.appendChild(meta);
    panel.appendChild(header);

    // MatchUp cards grid
    const grid = document.createElement('div');
    grid.className = 'sc-matchups-grid';

    const eventHandlers = buildCollectionEventHandlers({ matchUp, onRefresh });

    for (const tieMatchUp of collectionMatchUps) {
      const card = renderMatchUp({
        matchUp: tieMatchUp,
        isLucky: true, // suppresses connector lines
        eventHandlers,
        composition,
      });
      card.classList.add('sc-matchup-card');
      grid.appendChild(card);
    }

    panel.appendChild(grid);
    contentContainer.appendChild(panel);
  }

  return contentContainer;
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
            if (tieResult) setTieScore(tieResult);
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

    // Build a fake cell/row API to reuse participantMatchUpActions
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

export function setTieScore(result: any): void {
  const set = result?.score?.sets?.[0];
  if (!set) return;

  const side1Score = document.getElementById(TIE_SIDE_1)!;
  const side2Score = document.getElementById(TIE_SIDE_2)!;
  if (!side1Score || !side2Score) return;
  side1Score.classList.remove(WIN_INDICATOR);
  side2Score.classList.remove(WIN_INDICATOR);
  side1Score.innerHTML = set.side1Score;
  side2Score.innerHTML = set.side2Score;

  if (result.winningSide === 1) side1Score.classList.add(WIN_INDICATOR);
  if (result.winningSide === 2) side2Score.classList.add(WIN_INDICATOR);
}

function getParticipantName({ matchUp, sideNumber }: { matchUp: any; sideNumber: number }): string | undefined {
  return matchUp.sides.find((side: any) => side.sideNumber === sideNumber)?.participant?.participantName;
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
