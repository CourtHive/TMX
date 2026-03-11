/**
 * Draw view renderer with structure visualization.
 * Handles draw display, participant filtering, and morphdom-based updates.
 */
import { highlightTeam, removeTeamHighlight } from 'services/dom/events/teamHighlights';
import { compositions, controlBar, renderContainer, renderStructure } from 'courthive-components';
import { createRoundsTable } from 'components/tables/roundsTable/createRoundsTable';
import { tournamentEngine, eventConstants, tools, publishingGovernor } from 'tods-competition-factory';
import { createBracketTable } from 'components/tables/bracketTable/createBracketTable';
import { createRatingsTable } from 'components/tables/ratingsTable/createRatingsTable';
import { createStatsTable } from 'components/tables/statsTable/createStatsTable';
import { getEventControlItems } from './eventControlBar/eventControlItems';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { renderScorecard } from 'components/overlays/scorecard/scorecard';
import { removeAllChildNodes } from 'services/dom/transformers';
import { eventManager } from 'services/dom/events/eventManager';
import { isAssignmentMode } from './participantAssignmentMode';
import { destroyTables } from 'pages/tournament/destroyTable';
import { generateAdHocRound } from './generateAdHocRound';
import { generateQualifying } from './generateQualifying';
import { cleanupDrawPanel } from '../cleanupDrawPanel';
import { getEventHandlers } from '../getEventHandlers';
import { luckyLoserSelection } from 'components/modals/luckyLoserSelection';
import { drawControlBar } from './drawControlBar';
import { preferencesConfig } from 'config/preferencesConfig';
import { displayConfig } from 'config/displayConfig';
import { scalesMap } from 'config/scalesConfig';
import { context } from 'services/context';
import morphdom from 'morphdom';

import { EVENT_CONTROL, DRAWS_VIEW, QUALIFYING, ROUNDS_BRACKET, ROUNDS_RATINGS, ROUNDS_TABLE, ROUNDS_STATS } from 'constants/tmxConstants';

const { DOUBLES, TEAM } = eventConstants;

function computeRoundVisibilityState(
  drawId: string,
  structureId: string,
  matchUps: any[],
  event: any,
): Record<number, { hidden?: boolean; embargoed?: boolean }> | undefined {
  const pubState = publishingGovernor.getPublishState({ event })?.publishState;
  const structureDetail = pubState?.status?.drawDetails?.[drawId]?.structureDetails?.[structureId];
  if (!structureDetail) return undefined;

  const roundLimit = structureDetail.roundLimit;
  const scheduledRounds = structureDetail.scheduledRounds || {};
  const maxRound = matchUps.reduce((max: number, m: any) => Math.max(max, m.roundNumber || 0), 0);
  if (maxRound === 0) return undefined;

  const state: Record<number, { hidden?: boolean; embargoed?: boolean }> = {};
  let hasState = false;

  for (let rn = 1; rn <= maxRound; rn++) {
    const entry: { hidden?: boolean; embargoed?: boolean } = {};
    if (roundLimit != null && rn > roundLimit) {
      entry.hidden = true;
      hasState = true;
    }
    const rd = scheduledRounds[rn];
    if (rd?.embargo && new Date(rd.embargo).getTime() > Date.now()) {
      entry.embargoed = true;
      hasState = true;
    }
    if (entry.hidden || entry.embargoed) {
      state[rn] = entry;
    }
  }

  return hasState ? state : undefined;
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
  const eventHandlers = getEventHandlers({
    eventData,
    callback,
    drawId,
  });

  const display = structure?.display || drawData?.display || eventData?.eventInfo?.display || {};
  const compositionName = display?.compositionName;
  const configuration = display?.configuration;

  const composition =
    compositions[compositionName] ||
    displayConfig.get().composition ||
    compositions[(eventType === DOUBLES && 'National') || (eventType === TEAM && 'Basic') || 'National'];

  composition.configuration ??= {};

  composition.configuration.flags = false;
  Object.assign(composition.configuration, configuration);

  // Always inject active scale so ratings display regardless of composition
  composition.configuration.scaleAttributes = scalesMap[preferencesConfig.get().activeScale];

  if (!displayConfig.get().composition) {
    composition.configuration.genderColor = true;
    composition.configuration.showAddress = undefined;

    composition.configuration.allDrawPositions = true;
    composition.configuration.drawPositions = true;
  }
  composition.configuration.roundHeader = true;

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
      const roundVisibilityState = currentEvent
        ? computeRoundVisibilityState(drawId, structureId!, displayMatchUps, currentEvent)
        : undefined;

      const content = renderContainer({
        content: renderStructure({
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
        }),
        theme: composition.theme,
      });

      const isParticipantEl = (node: any) =>
        node instanceof HTMLElement &&
        (node.classList?.contains('tmx-p') || node.classList?.contains('tmx-i'));

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

            const id = node.getAttribute?.('id');
            if (id && id !== 'undefined' && id !== '') return id;
            return undefined;
          },
        });
      } else if (drawsView) {
        drawsView.appendChild(content);
      }

      // Apply after DOM insertion so click listeners attach to live nodes, not the morphdom template
      const liveNode = drawsView?.firstChild as HTMLElement;
      if (liveNode) applyLuckyRoundHighlighting(liveNode, drawId, structureId!, callback);
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
        const scorecard = (renderScorecard as any)({ matchUp: matchUps[0], onRefresh: updateView });
        if (scorecard) dv.appendChild(scorecard);
      }
    } else {
      updateDrawDisplay();
    }
  };

  const roundNumbers = Object.keys(roundMatchUps || {})
    .map(Number)
    .sort((a, b) => a - b);

  const onInitialRoundChange = (roundNumber: number) => {
    initialRoundNumber = roundNumber;
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
    const scorecard = (renderScorecard as any)({ matchUp: matchUps[0], onRefresh: updateView });
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
