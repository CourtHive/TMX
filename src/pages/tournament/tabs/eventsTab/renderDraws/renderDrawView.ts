/**
 * Draw view renderer with structure visualization.
 * Handles draw display, participant filtering, and morphdom-based updates.
 */
import { compositions, controlBar, renderContainer, renderInlineMatchUp, renderStructure } from 'courthive-components';
import { generateVoluntaryConsolationPanel } from './generateVoluntaryConsolationPanel';
import { highlightTeam, removeTeamHighlight } from 'services/dom/events/teamHighlights';
import { createBracketTable } from 'components/tables/bracketTable/createBracketTable';
import { createRatingsTable } from 'components/tables/ratingsTable/createRatingsTable';
import { computeRoundVisibilityState } from 'functions/computeRoundVisibilityState';
import { createRoundsTable } from 'components/tables/roundsTable/createRoundsTable';
import { createStatsTable } from 'components/tables/statsTable/createStatsTable';
import { luckyLoserSelection } from 'components/modals/luckyLoserSelection';
import { getEventControlItems } from './eventControlBar/eventControlItems';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { renderScorecard } from 'components/overlays/scorecard/scorecard';
import { removeAllChildNodes } from 'services/dom/transformers';
import { eventManager } from 'services/dom/events/eventManager';
import { isAssignmentMode } from './participantAssignmentMode';
import { destroyTables } from 'pages/tournament/destroyTable';
import { generateAdHocRound } from './generateAdHocRound';
import { generateQualifying } from './generateQualifying';
import { preferencesConfig } from 'config/preferencesConfig';
import { cleanupDrawPanel } from '../cleanupDrawPanel';
import { getEventHandlers } from '../getEventHandlers';
import { drawControlBar } from './drawControlBar';
import { displayConfig } from 'config/displayConfig';
import { scalesMap } from 'config/scalesConfig';
import { context } from 'services/context';
import morphdom from 'morphdom';
import {
  tournamentEngine,
  eventConstants,
  drawDefinitionConstants,
  tools,
  publishingGovernor,
} from 'tods-competition-factory';

import {
  EVENT_CONTROL,
  DRAWS_VIEW,
  QUALIFYING,
  ROUNDS_BRACKET,
  ROUNDS_RATINGS,
  ROUNDS_TABLE,
  ROUNDS_STATS,
} from 'constants/tmxConstants';

const { DOUBLES, TEAM } = eventConstants;
const { VOLUNTARY_CONSOLATION } = drawDefinitionConstants;

function getStructureDetail(drawId: string, structureId: string, event: any): any {
  const pubState = publishingGovernor.getPublishState({ event })?.publishState;
  return pubState?.status?.drawDetails?.[drawId]?.structureDetails?.[structureId];
}

export function renderDrawView({
  eventId,
  drawId,
  structureId,
  roundsView,
  redraw,
}: {
  eventId: string;
  drawId: string;
  structureId?: string;
  roundsView?: string;
  redraw?: boolean;
}): void {
  // Early return if in assignment mode (handled by participantAssignmentMode)
  if (isAssignmentMode()) {
    return;
  }

  const events = tournamentEngine.getEvents().events;
  if (!events?.length) return;
  let isAdHoc: boolean;

  eventManager.register('tmx-tm', 'mouseover', highlightTeam);
  eventManager.register('tmx-tm', 'mouseout', removeTeamHighlight);

  let participantFilter: string | undefined;
  let initialRoundNumber = 1;
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
    isAdHoc = tournamentEngine.isAdHoc({ structure });
    ({ roundMatchUps, stage } = tools.makeDeepCopy(structure || {}));
    matchUps = Object.values(roundMatchUps || {}).flat();
    if (isAdHoc) matchUps.sort(tools.matchUpScheduleSort);
  };

  destroyTables();
  getData();

  const callback = (params?: any) => {
    const { refresh, view } = params ?? {};
    if (view) {
      cleanupDrawPanel();
      navigateToEvent({ eventId, drawId, structureId, renderDraw: true, view });
    } else if (refresh || participantFilter) {
      // Structural changes (e.g. lucky draw advancement) or active filter: full re-render
      cleanupDrawPanel();
      renderDrawView({ eventId, drawId, structureId, redraw: true, roundsView });
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
    compositions[compositionName] ||
    displayConfig.get().composition ||
    compositions[(eventType === DOUBLES && 'National') || (eventType === TEAM && 'Basic') || 'National'];

  composition.configuration ??= {};

  Object.assign(composition.configuration, configuration);

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
      if (stage === QUALIFYING) {
        generateQualifying({ drawData, drawId, eventId });
      } else if (stage === VOLUNTARY_CONSOLATION && !isAdHoc) {
        generateVoluntaryConsolationPanel({ structure, drawId, eventId, callback });
      } else if (isAdHoc) {
        generateAdHocRound({ structure, drawId, callback });
      } else {
        const structureId = structures?.[0]?.structureId;
        return renderDrawView({ eventId, drawId, structureId, redraw: true });
      }
    } else if (roundsView === ROUNDS_TABLE) {
      (createRoundsTable as any)({ matchUps: displayMatchUps, eventData });
    } else if (roundsView === ROUNDS_STATS) {
      createStatsTable({ eventId, drawId, structureId: structureId! });
    } else if (roundsView === ROUNDS_RATINGS) {
      createRatingsTable({ eventId, drawId, structureId: structureId! });
    } else if (roundsView === ROUNDS_BRACKET) {
      createBracketTable({ eventId, drawId, structureId: structureId! });
    } else {
      const { event: currentEvent } = tournamentEngine.getEvent({ drawId });
      const structureDetail = currentEvent ? getStructureDetail(drawId, structureId!, currentEvent) : undefined;
      const roundVisibilityState = computeRoundVisibilityState(structureDetail, displayMatchUps);

      // Identify matchUps eligible for inline scoring wrapping
      const irregularStatuses = new Set(['RETIRED', 'DEFAULTED', 'WALKOVER', 'SUSPENDED', 'CANCELLED', 'ABANDONED']);
      if (inlineManager) {
        for (const m of displayMatchUps as any[]) {
          const hasBothParticipants = m?.sides?.length === 2 && m.sides[0]?.participant && m.sides[1]?.participant;
          if (!hasBothParticipants) continue;
          // Mark fresh ready-to-score matchUps as IN_PROGRESS so the LIVE chip renders.
          // Don't override matchUps that already have a meaningful status (SUSPENDED, etc.)
          if (m?.readyToScore && !m?.winningSide && (!m?.matchUpStatus || m.matchUpStatus === 'TO_BE_PLAYED')) {
            m.matchUpStatus = 'IN_PROGRESS';
          }
        }
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

      // Replace eligible matchUp elements with interactive inline scoring wrappers.
      // Includes: IN_PROGRESS (fresh or ongoing) and irregular endings (RETIRED, etc.)
      // that need inline handlers for status changes.
      if (inlineManager) {
        for (const m of displayMatchUps as any[]) {
          const isInProgress = m?.matchUpStatus === 'IN_PROGRESS' && !m?.winningSide;
          const isIrregularEnding = irregularStatuses.has(m?.matchUpStatus);
          if (!isInProgress && !isIrregularEnding) continue;
          if (!m?.sides?.length || !m.sides[0]?.participant || !m.sides[1]?.participant) continue;

          const existing = structureContent.querySelector(`#${CSS.escape(m.matchUpId)}`);
          if (!existing?.parentElement) continue;

          // Derive connector params from the matchUp so bracket lines render correctly
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

      const content = renderContainer({
        content: structureContent,
        theme: composition.theme,
      });

      const isParticipantEl = (node: any) =>
        node instanceof HTMLElement && (node.classList?.contains('tmx-p') || node.classList?.contains('tmx-i'));

      // Only preserve inline wrappers for matchUps still eligible for inline scoring.
      // Completed matchUps should be replaced with their normal rendered state.
      const isActiveInlineScoringEl = (node: any) => {
        if (
          !inlineManager ||
          !(node instanceof HTMLElement) ||
          !node.classList?.contains('chc-inline-scoring-wrapper')
        ) {
          return false;
        }
        const matchUpId = node.dataset.matchupId;
        if (!matchUpId) return false;
        const m = (displayMatchUps as any[]).find((mu: any) => mu?.matchUpId === matchUpId);
        // Don't preserve wrappers for completed matchUps — they need to render normally
        return m && m.matchUpStatus !== 'COMPLETED' && !m.winningSide;
      };

      const targetNode = drawsView?.firstChild;
      if (targetNode) {
        morphdom(targetNode, content, {
          getNodeKey(node: any) {
            // Participant wrappers (tmx-p) and info elements (tmx-i) share
            // participant UUIDs as their id attribute.  The duplicate keys
            // cause morphdom's lookup to lose track of the outer element,
            // leading to stale nodes when participants are removed.
            // Returning undefined forces positional matching instead.
            if (isParticipantEl(node)) return undefined;

            // Inline scoring wrappers use data-matchup-id instead of id
            // to avoid duplicate IDs with the inner matchUp element.
            // Use it as the key so morphdom can match wrappers with their
            // corresponding matchUp elements in the new content.
            const matchUpId = node.getAttribute?.('data-matchup-id');
            if (matchUpId) return matchUpId;

            const id = node.getAttribute?.('id');
            if (id && id !== 'undefined' && id !== '') return id;
            return undefined;
          },
          onBeforeElUpdated(fromEl: any, _toEl: any) {
            // Preserve active inline scoring wrappers — they manage their own re-render loop.
            // Completed matchUps are allowed through so morphdom replaces the stale wrapper.
            return !isActiveInlineScoringEl(fromEl);
          },
        });
      } else if (drawsView) {
        drawsView.appendChild(content);
      }

      // Apply after DOM insertion so click listeners attach to live nodes, not the morphdom template
      const liveNode = drawsView?.firstChild as HTMLElement;
      if (liveNode) {
        applyLuckyRoundHighlighting(liveNode, drawId, structureId!, callback);
        applyRRGroupCompletionHighlighting(liveNode, displayMatchUps as any[]);
      }
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

  const onInitialRoundChange = (roundNumber: number) => {
    initialRoundNumber = roundNumber;
    getData(); // fresh matchUps — renderRound mutates roundFactor in-place
    if (drawsView) removeAllChildNodes(drawsView);
    updateDrawDisplay();
  };

  drawControlBar({
    onInitialRoundChange,
    initialRoundNumber,
    updateDisplay: update,
    existingView: roundsView,
    roundNumbers,
    structure,
    callback,
    drawId,
  });
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
  const luckyStatus = tournamentEngine.getLuckyDrawRoundStatus({ drawId });
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
  const drawDefinition = tournamentEngine.getEvent({ drawId })?.drawDefinition;
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

function applyRRGroupCompletionHighlighting(content: HTMLElement, matchUps: any[]) {
  if (!matchUps.some((m: any) => m.isRoundRobin)) return;

  // Group matchUps by structureId (each RR group is a child structure)
  const groups: Record<string, any[]> = {};
  for (const m of matchUps) {
    if (!m.structureId) continue;
    groups[m.structureId] ??= [];
    groups[m.structureId].push(m);
  }

  for (const [groupId, groupMatchUps] of Object.entries(groups)) {
    const allComplete = groupMatchUps.every((m: any) => m.winningSide);
    if (!allComplete) continue;

    content.querySelectorAll(`.chc-rr-group[data-group-id="${groupId}"]`).forEach((el) => {
      (el as HTMLElement).classList.add('rr-group-complete');
    });
  }
}
