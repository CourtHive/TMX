/**
 * Draw view renderer with structure visualization.
 * Handles draw display, participant filtering, and morphdom-based updates.
 */
import { applySwissScoreGroupShading, sortSwissRoundMatchUpsByScoreGroup } from './applySwissScoreGroupShading';
import { eventConstants, drawDefinitionConstants, tools, publishingGovernor } from 'tods-competition-factory';
import { createSwissStandingsTable } from 'components/tables/swissStandingsTable/createSwissStandingsTable';
import { shouldShowDrawMinimap, wireDrawMinimap, pickMinimapQuarterCount } from './applyDrawMinimap';
import { resolveCompositionByName } from 'services/compositions/resolveCompositionByName';
import { highlightTeam, removeTeamHighlight } from 'services/dom/events/teamHighlights';
import { createBracketTable } from 'components/tables/bracketTable/createBracketTable';
import { createRatingsTable } from 'components/tables/ratingsTable/createRatingsTable';
import { renderSwissChart } from 'components/tables/swissChartView/renderSwissChart';
import { createRoundsTable } from 'components/tables/roundsTable/createRoundsTable';
import { createStatsTable } from 'components/tables/statsTable/createStatsTable';
import { maybeRenderGenerateQualifyingBanner } from './generateQualifyingBanner';
import { luckyLoserSelection } from 'components/modals/luckyLoserSelection';
import { getEventControlItems } from './eventControlBar/eventControlItems';
import { peekPendingMatchUpFocus, consumePendingMatchUpFocus } from 'services/dom/matchUpFocus';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { renderScorecard } from 'components/overlays/scorecard/scorecard';
import { voluntaryConsolationPanel } from './voluntaryConsolationPanel';
import { applyCrowdsourcedBadges } from './applyCrowdsourcedBadges';
import { renderSwissGenerateButton } from './generateSwissRound';
import { removeAllChildNodes } from 'services/dom/transformers';
import { eventManager } from 'services/dom/events/eventManager';
import { isAssignmentMode } from './participantAssignmentMode';
import { destroyTables } from 'pages/tournament/destroyTable';
import { preferencesConfig } from 'config/preferencesConfig';
import { tournamentEngine } from 'services/factory/engine';
import { generateAdHocRound } from './generateAdHocRound';
import { generateQualifying } from './generateQualifying';
import { cleanupDrawPanel } from '../cleanupDrawPanel';
import { getEventHandlers } from '../getEventHandlers';
import { displayConfig } from 'config/displayConfig';
import { drawControlBar } from './drawControlBar';
import { scalesMap } from 'config/scalesConfig';
import { generateMain } from './generateMain';
import { context } from 'services/context';
import morphdom from 'morphdom';
import {
  buildStructureMinimap,
  compositions,
  controlBar,
  renderContainer,
  renderInlineMatchUp,
  renderStructure,
} from 'courthive-components';

import {
  EVENT_CONTROL,
  DRAWS_VIEW,
  QUALIFYING,
  ROUNDS_BRACKET,
  ROUNDS_RATINGS,
  ROUNDS_STANDINGS,
  ROUNDS_SWISS_CHART,
  ROUNDS_TABLE,
  ROUNDS_STATS,
} from 'constants/tmxConstants';

const { DOUBLES, TEAM } = eventConstants;
const { MAIN, SWISS, VOLUNTARY_CONSOLATION } = drawDefinitionConstants;

function getStructureDetail(drawId: string, structureId: string, event: any): any {
  const pubState = publishingGovernor.getPublishState({ event })?.publishState;
  return pubState?.status?.drawDetails?.[drawId]?.structureDetails?.[structureId];
}

function renderEmptyStructure(
  stage: string,
  isAdHoc: boolean,
  params: {
    drawData: any;
    structure: any;
    structures: any[];
    drawId: string;
    eventId: string;
    callback: (params?: any) => void;
  },
): void {
  const { drawData, structure, structures, drawId, eventId, callback } = params;
  // Clear #drawsView before painting the empty-structure affordance. Every generator below
  // (generateQualifying/generateMain/generateSwissRound/generateAdHocRound/voluntaryConsolationPanel)
  // appends without clearing, and the only prior clear (line ~331) runs solely on `redraw` — so a
  // non-redraw re-render of an empty structure stacked duplicate "Generate round"/"Generate ..." panels
  // (observed: 3 stacked buttons on a draw whose structure was emptied by an allowReplacement wipe).
  const emptyStructureView = document.getElementById(DRAWS_VIEW);
  if (emptyStructureView) removeAllChildNodes(emptyStructureView);
  const isSwiss = drawData?.drawType === SWISS;
  const hasGeneratedQualifying = structures.some(
    (s: any) =>
      s.stage === QUALIFYING &&
      (s.matchUps?.length > 0 || Object.values(s.roundMatchUps || {}).some((r: any) => r?.length > 0)),
  );
  if (stage === QUALIFYING) {
    generateQualifying({ drawData, drawId, eventId });
  } else if (stage === MAIN && hasGeneratedQualifying) {
    generateMain({ drawData, drawId, eventId });
  } else if (stage === VOLUNTARY_CONSOLATION && !isAdHoc) {
    voluntaryConsolationPanel({ structure, drawId, eventId, callback });
  } else if (isSwiss) {
    renderSwissGenerateButton({ structure, drawId, callback });
  } else if (isAdHoc) {
    generateAdHocRound({ structure, drawId, callback });
  } else {
    const fallbackStructureId = structures?.[0]?.structureId;
    renderDrawView({ eventId, drawId, structureId: fallbackStructureId, redraw: true });
  }
}

function markReadyMatchUpsInProgress(displayMatchUps: any[]): void {
  for (const m of displayMatchUps) {
    const hasBothParticipants = m?.sides?.length === 2 && m.sides[0]?.participant && m.sides[1]?.participant;
    if (!hasBothParticipants) continue;
    if (m?.readyToScore && !m?.winningSide && (!m?.matchUpStatus || m.matchUpStatus === 'TO_BE_PLAYED')) {
      m.matchUpStatus = 'IN_PROGRESS';
    }
  }
}

function applyInlineScoringWrappers(
  structureContent: HTMLElement,
  displayMatchUps: any[],
  irregularStatuses: Set<string>,
  inlineManager: any,
  composition: any,
  initialRoundNumber: number,
  participantFilter: string | undefined,
): void {
  for (const m of displayMatchUps) {
    const isInProgress = m?.matchUpStatus === 'IN_PROGRESS' && !m?.winningSide;
    const isIrregularEnding = irregularStatuses.has(m?.matchUpStatus);
    if (!isInProgress && !isIrregularEnding) continue;
    if (!m?.sides?.length || !m.sides[0]?.participant || !m.sides[1]?.participant) continue;

    const existing = structureContent.querySelector(`#${CSS.escape(m.matchUpId)}`);
    if (!existing?.parentElement) continue;

    const moiety = m.roundPosition ? m.roundPosition % 2 === 1 : undefined;
    const isFinalRound = m.finishingRound ? Number(m.finishingRound) === 1 : false;

    const inlineEl = renderInlineMatchUp({
      matchUp: m,
      composition,
      manager: inlineManager,
      matchUpFormat: m.matchUpFormat,
      initialRoundNumber,
      searchActive: !!participantFilter,
      isFinalRound,
      moiety,
    });
    existing.parentElement.replaceChild(inlineEl, existing);
  }
}

function applyMorphdomUpdate(
  drawsView: HTMLElement | null,
  content: HTMLElement,
  displayMatchUps: any[],
  inlineManager: any,
): void {
  const isParticipantEl = (node: any) =>
    node instanceof HTMLElement && (node.classList?.contains('tmx-p') || node.classList?.contains('tmx-i'));

  const isActiveInlineScoringEl = (node: any) => {
    if (!inlineManager || !(node instanceof HTMLElement) || !node.classList?.contains('chc-inline-scoring-wrapper')) {
      return false;
    }
    const matchUpId = node.dataset.matchupId;
    if (!matchUpId) return false;
    const m = displayMatchUps.find((mu: any) => mu?.matchUpId === matchUpId);
    return m && m.matchUpStatus !== 'COMPLETED' && !m.winningSide;
  };

  const targetNode = drawsView?.firstChild;
  if (targetNode) {
    morphdom(targetNode, content, {
      getNodeKey(node: any) {
        if (isParticipantEl(node)) return undefined;

        const matchUpId = node.getAttribute?.('data-matchup-id');
        if (matchUpId) return matchUpId;

        const id = node.getAttribute?.('id');
        if (id && id !== 'undefined' && id !== '') return id;
        return undefined;
      },
      onBeforeElUpdated(fromEl: any, _toEl: any) {
        return !isActiveInlineScoringEl(fromEl);
      },
    });
  } else if (drawsView) {
    drawsView.appendChild(content);
  }
}

export function renderDrawView({
  eventId,
  drawId,
  structureId,
  roundsView,
  redraw,
  initialRoundNumber: initialRoundNumberParam,
}: {
  eventId: string;
  drawId: string;
  structureId?: string;
  roundsView?: string;
  redraw?: boolean;
  initialRoundNumber?: number;
}): void {
  // Early return if in assignment mode (handled by participantAssignmentMode)
  if (isAssignmentMode()) {
    return;
  }

  const events = tournamentEngine.q.events();
  if (!events?.length) return;
  let isAdHoc: boolean;

  eventManager.register('tmx-tm', 'mouseover', highlightTeam);
  eventManager.register('tmx-tm', 'mouseout', removeTeamHighlight);

  let participantFilter: string | undefined;
  let initialRoundNumber = initialRoundNumberParam ?? 1;
  let roundMatchUps: any;
  let structures: any[] = [];
  let eventData: any;
  let eventType: string = '';
  let structure: any;
  let drawData: any;
  let matchUps: any[] = [];
  let stage: string;

  const getData = () => {
    eventData = tournamentEngine.getEventData({
      participantsProfile: {
        convertExtensions: true,
        withScaleValues: true,
        withGroupings: true,
        withISO2: true,
        withIOC: true,
      },
      includePositionAssignments: true,
      eventId,
    })?.eventData;
    eventType = eventData?.eventInfo?.eventType;
    drawData = eventData?.drawsData?.find((data: any) => data.drawId === drawId);
    structures = drawData?.structures || [];
    structureId = structureId || structures?.[0]?.structureId;
    structure = structures.find((s: any) => s.structureId === structureId);
    if (!structure && structures.length) {
      structureId = structures[0].structureId;
      structure = structures[0];
    }
    isAdHoc = tournamentEngine.isAdHoc({ structure });
    ({ roundMatchUps, stage } = tools.makeDeepCopy(structure || {}));

    if (drawData?.drawType === SWISS && roundMatchUps && stage !== QUALIFYING) {
      sortSwissRoundMatchUpsByScoreGroup(roundMatchUps, drawId);
    }

    matchUps = Object.values(roundMatchUps || {}).flat();
    if (isAdHoc && stage !== QUALIFYING) matchUps.sort(tools.matchUpScheduleSort);
  };

  destroyTables();
  getData();

  // A pending matchUp focus (set before a link/follow navigation) drives the
  // initial round so the target matchUp is on-screen; it's highlighted after
  // render. Only honour it when the caller didn't pin an explicit round.
  const focusMatchUpId = peekPendingMatchUpFocus();
  if (focusMatchUpId && initialRoundNumberParam == null) {
    const focusMatchUp = matchUps.find((m: any) => m?.matchUpId === focusMatchUpId);
    if (focusMatchUp?.roundNumber) initialRoundNumber = focusMatchUp.roundNumber;
  }

  const callback = (params?: any) => {
    const { refresh, view } = params ?? {};
    if (view) {
      cleanupDrawPanel();
      navigateToEvent({ eventId, drawId, structureId, renderDraw: true, view });
    } else if (refresh || participantFilter) {
      // Structural changes (e.g. lucky draw advancement) or active filter: full re-render.
      // Preserve the selected round so a refresh (e.g. minimap toggle) doesn't reset to R1.
      cleanupDrawPanel();
      renderDrawView({ eventId, drawId, structureId, redraw: true, roundsView, initialRoundNumber });
    } else {
      // Lightweight update: refresh data and morphdom-patch the draw in place
      updateView();
    }
  };
  const dual = matchUps?.length === 1 && eventData?.eventInfo?.eventType === TEAM;

  const display = structure?.display || drawData?.display || eventData?.eventInfo?.display || {};
  const compositionName = display?.compositionName;
  const configuration = display?.configuration;

  const composition =
    resolveCompositionByName(compositionName) ||
    displayConfig.get().composition ||
    compositions[(eventType === DOUBLES && 'National') || (eventType === TEAM && 'Basic') || 'National'];

  composition.configuration ??= {};

  Object.assign(composition.configuration, configuration);

  // Display extension may carry a colors snapshot (saved when the user
  // applied a custom composition). Extension colors win over resolver
  // defaults so display state survives later edits to the underlying
  // user composition.
  if (display?.colors) {
    composition.colors = { ...display.colors };
  }

  // Always inject active scale so ratings display regardless of composition
  composition.configuration.scaleAttributes = scalesMap[preferencesConfig.get().activeScale];

  if (!displayConfig.get().composition && !compositionName) {
    composition.configuration.genderColor = true;
    composition.configuration.showAddress = undefined;

    composition.configuration.allDrawPositions = true;
    composition.configuration.drawPositions = true;
  }
  composition.configuration.roundHeader = true;

  const { eventHandlers, inlineManager } = getEventHandlers({
    composition,
    eventData,
    callback,
    drawId,
  });

  const drawsView = document.getElementById(DRAWS_VIEW);
  if (redraw && drawsView) removeAllChildNodes(drawsView);

  const updateDrawDisplay = () => {
    if (dual) return;

    for (const key of Object.keys(structure?.roundMatchUps ?? {})) {
      structure.roundMatchUps[key] = roundMatchUps?.[key]?.filter(({ sides }: any) => {
        const hasParticipant = sides?.some(({ participant }: any) =>
          participant?.participantName.toLowerCase().includes(participantFilter),
        );
        return hasParticipant || !participantFilter;
      });
    }
    const displayMatchUps = Object.values(structure.roundMatchUps || {}).flat();

    if (!matchUps.length) {
      renderEmptyStructure(stage, isAdHoc, {
        drawData,
        structure,
        structures,
        drawId,
        eventId,
        callback,
      });
    } else if (roundsView === ROUNDS_TABLE) {
      (createRoundsTable as any)({ matchUps: displayMatchUps, eventData });
    } else if (roundsView === ROUNDS_STANDINGS) {
      createSwissStandingsTable({ eventId, drawId, structureId: structureId! });
    } else if (roundsView === ROUNDS_SWISS_CHART) {
      renderSwissChart({ eventId, drawId, structureId: structureId! });
    } else if (roundsView === ROUNDS_STATS) {
      createStatsTable({ eventId, drawId, structureId: structureId! });
    } else if (roundsView === ROUNDS_RATINGS) {
      createRatingsTable({ eventId, drawId, structureId: structureId! });
    } else if (roundsView === ROUNDS_BRACKET) {
      createBracketTable({ eventId, drawId, structureId: structureId! });
    } else {
      const { event: currentEvent } = tournamentEngine.getEvent({ drawId });
      const structureDetail = currentEvent ? getStructureDetail(drawId, structureId!, currentEvent) : undefined;
      const roundVisibilityState = publishingGovernor.getRoundVisibilityState(structureDetail, displayMatchUps as any);

      const irregularStatuses = new Set(['RETIRED', 'DEFAULTED', 'WALKOVER', 'SUSPENDED', 'CANCELLED', 'ABANDONED']);
      if (inlineManager) {
        markReadyMatchUpsInProgress(displayMatchUps as any[]);
      }

      const structureContent = renderStructure({
        context: { drawId, structureId, roundVisibilityState },
        searchActive: !!participantFilter,
        matchUps: displayMatchUps as any,
        initialRoundNumber,
        eventHandlers,
        composition,
        selectedMatchUpId: undefined,
        structureId,
        finalColumn: undefined,
        minWidth: undefined,
      });

      if (inlineManager) {
        applyInlineScoringWrappers(
          structureContent,
          displayMatchUps as any[],
          irregularStatuses,
          inlineManager,
          composition,
          initialRoundNumber,
          participantFilter,
        );
      }

      const containerEl = renderContainer({
        content: structureContent,
        theme: composition.theme,
      });

      const roundCount = Object.keys(roundMatchUps || {}).length;
      const showMinimap = shouldShowDrawMinimap({
        drawType: drawData?.drawType,
        initialRoundNumber,
        participantFilter,
        isAdHoc,
        roundCount,
      });

      let content: HTMLElement = containerEl;
      if (showMinimap) {
        const round1Count = roundMatchUps?.[initialRoundNumber ?? 1]?.length ?? 0;
        const quarterCount = pickMinimapQuarterCount(round1Count);
        const minimap = buildStructureMinimap({ matchUps: displayMatchUps as any, quarterCount });
        if (minimap) {
          const frame = document.createElement('div');
          frame.className = 'chc-draw-frame';
          frame.appendChild(minimap);
          frame.appendChild(containerEl);
          content = frame;
        }
      }

      applyMorphdomUpdate(drawsView, content, displayMatchUps as any[], inlineManager);

      // Apply after DOM insertion so click listeners attach to live nodes, not the morphdom template
      const liveNode = drawsView?.firstChild as HTMLElement;
      if (liveNode) {
        applyLuckyRoundHighlighting(liveNode, drawId, structureId!, callback);
        applyCrowdsourcedBadges(liveNode);
        if (drawData?.drawType === SWISS && stage !== QUALIFYING) {
          applySwissScoreGroupShading(liveNode, drawId);
        }
        if (liveNode.classList.contains('chc-draw-frame')) {
          wireDrawMinimap(liveNode);
        }
        // Consume any pending focus once its matchUp is in the DOM: scroll-to +
        // pulse. No-op / left in place if not rendered (e.g. a non-columns view).
        consumePendingMatchUpFocus();
      }

      // Recovery banner: main has reserved qualifier slots but no
      // QUALIFYING structure exists. The helper internally short-circuits
      // when the conditions don't hold; safe to call from every bracket
      // render and rely on it to clear any stale banner on re-renders.
      const { drawDefinition: liveDrawDefinition } = tournamentEngine.getEvent({ drawId }) ?? {};
      maybeRenderGenerateQualifyingBanner({
        container: drawsView,
        drawDefinition: liveDrawDefinition,
        stage,
        drawId,
        eventId,
        drawName: drawData?.drawName,
        callback,
      });
    }
  };

  const update = () => {
    getData();
    updateDrawDisplay();
  };

  const updateView = () => {
    getData();
    if (dual) {
      // For team dual matches: clear and re-render the scorecard with fresh data
      const dv = document.getElementById(DRAWS_VIEW);
      if (dv) {
        removeAllChildNodes(dv);
        const scorecard = (renderScorecard as any)({ matchUp: matchUps[0], composition, onRefresh: updateView });
        if (scorecard) dv.appendChild(scorecard);
      }
    } else {
      updateDrawDisplay();
    }
  };

  // Allow remote mutations to trigger an in-place morphdom refresh
  context.refreshActiveTable = updateView;

  const roundNumbers = Object.keys(roundMatchUps || {})
    .map(Number)
    .sort((a, b) => a - b);

  const renderDrawControlBar = () =>
    drawControlBar({
      onInitialRoundChange,
      initialRoundNumber,
      updateDisplay: update,
      existingView: roundsView,
      roundNumbers,
      structure,
      callback,
      drawId,
      participantFilter,
    });

  const onInitialRoundChange = (roundNumber: number) => {
    initialRoundNumber = roundNumber;
    getData(); // fresh matchUps — renderRound mutates roundFactor in-place
    if (drawsView) removeAllChildNodes(drawsView);
    updateDrawDisplay();
    // Rebuild the control bar so the minimap toggle icon and active round tab
    // re-evaluate against the new round. controlBar clears + rebuilds #drawControl,
    // so this is idempotent (no duplicate toggle). Without it, switching to R1
    // in-view shows the minimap body but not its toggle (and stale state on R1→SF).
    renderDrawControlBar();
  };

  renderDrawControlBar();
  const eventControlElement = document.getElementById(EVENT_CONTROL) || undefined;
  const updateControlBar = (refresh?: boolean) => {
    if (refresh) getData();

    const searchFilter = (rowData: any) => rowData.searchText?.includes(participantFilter);
    const updateParticipantFilter = (value: string) => {
      if (!value) {
        Object.values(context.tables)
          .filter(Boolean)
          .forEach((table: any) => table.clearFilter());
      }
      participantFilter = value?.toLowerCase();
      if (value) {
        Object.values(context.tables)
          .filter(Boolean)
          .forEach((table: any) => table.addFilter(searchFilter));
      }
      if (drawsView) removeAllChildNodes(drawsView);
      updateDrawDisplay();
    };

    const items = (getEventControlItems as any)({
      updateParticipantFilter,
      updateControlBar,
      structureId: structureId!,
      eventData,
      drawData,
      matchUps,
      eventId,
      drawId,
      roundsView,
    });

    controlBar({ target: eventControlElement, items });
  };

  if (!drawData) {
    console.log('no draw data', { eventData, drawData });
    return;
  }

  if (!structureId) {
    structureId = drawData.structures?.[0]?.structureId;
  }
  if (!structureId) {
    console.log('structure not found');
    return;
  }

  if (dual) {
    const scorecard = (renderScorecard as any)({ matchUp: matchUps[0], composition, onRefresh: updateView });
    if (scorecard && drawsView) {
      drawsView.appendChild(scorecard);
    }
  } else {
    updateDrawDisplay();
  }

  updateControlBar();
}

function applyLuckyRoundHighlighting(
  content: HTMLElement,
  drawId: string,
  structureId: string,
  callback: (params?: any) => void,
) {
  const luckyStatus = tournamentEngine.getLuckyDrawRoundStatus({ drawId, structureId });
  if (!luckyStatus?.isLuckyDraw) return;

  for (const round of luckyStatus.rounds || []) {
    const el = content.querySelector(`.tmx-rd[roundNumber="${round.roundNumber}"]`) as HTMLElement;
    if (!el) continue;
    if (round.needsLuckySelection) {
      el.classList.add('lucky-needs-selection');
      el.addEventListener('click', (e) => {
        // Don't trigger if click was on a matchUp or interactive element inside the round
        const target = e.target as HTMLElement;
        if (target.closest('.tmx-mu, .tmx-p, button, input, a')) return;
        luckyLoserSelection({
          roundNumber: round.roundNumber,
          structureId,
          callback,
          drawId,
        });
      });
    }
  }

  // Green highlighting on consolidation target structure rounds
  applyConsolidationReadyHighlighting(content, drawId, structureId, luckyStatus);
}

function applyConsolidationReadyHighlighting(
  content: HTMLElement,
  drawId: string,
  currentStructureId: string,
  luckyStatus: any,
) {
  // Check if the current structure is a target of any LOSER links from the lucky draw
  const drawDefinition = tournamentEngine.q.drawDefinition({ drawId });
  if (!drawDefinition?.links?.length) return;

  for (const round of luckyStatus.rounds || []) {
    if (!round.consolidationLinks?.length) continue;

    for (const link of round.consolidationLinks) {
      // Only highlight when viewing the target structure
      if (link.targetStructureId !== currentStructureId) continue;
      // Only highlight when the source round needs selection and losers aren't yet placed
      if (!round.needsLuckySelection || link.losersPlaced) continue;

      const el = content.querySelector(`.tmx-rd[roundNumber="${link.targetRoundNumber}"]`) as HTMLElement;
      if (el) {
        el.classList.add('consolidation-ready');
      }
    }
  }
}

