/**
 * Draw view renderer with structure visualization.
 * Handles draw display, participant filtering, and morphdom-based updates.
 */
import { highlightTeam, removeTeamHighlight } from 'services/dom/events/teamHighlights';
import { compositions, controlBar, renderContainer, renderStructure } from 'courthive-components';
import { createRoundsTable } from 'components/tables/roundsTable/createRoundsTable';
import { tournamentEngine, eventConstants, tools } from 'tods-competition-factory';
import { createBracketTable } from 'components/tables/bracketTable/createBracketTable';
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
import { drawControlBar } from './drawControlBar';
import { context } from 'services/context';
import { env } from 'settings/env';
import morphdom from 'morphdom';

import { EVENT_CONTROL, DRAWS_VIEW, QUALIFYING, ROUNDS_BRACKET, ROUNDS_TABLE, ROUNDS_STATS } from 'constants/tmxConstants';

const { DOUBLES, TEAM } = eventConstants;

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
    const redraw = refresh || participantFilter;
    cleanupDrawPanel();
    if (view) {
      navigateToEvent({ eventId, drawId, structureId, renderDraw: true, view });
    } else {
      renderDrawView({ eventId, drawId, structureId, redraw, roundsView: view });
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
    env.composition ||
    compositions[(eventType === DOUBLES && 'National') || (eventType === TEAM && 'Basic') || 'National'];

  composition.configuration ??= {};

  composition.configuration.flags = false;
  Object.assign(composition.configuration, configuration);

  if (composition.configuration.scaleAttributes) {
    composition.configuration.scaleAttributes = env.scales[env.activeScale];
  }

  if (!env.composition) {
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
    } else if (roundsView === ROUNDS_BRACKET) {
      createBracketTable({ eventId, drawId, structureId: structureId! });
    } else {
      const content = renderContainer({
        content: renderStructure({
          context: { drawId, structureId },
          searchActive: !!participantFilter,
          matchUps: displayMatchUps as any,
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
    }
  };

  const update = () => {
    getData();
    updateDrawDisplay();
  };
  drawControlBar({ updateDisplay: update, drawId, structure, existingView: roundsView, callback });
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
    const scorecard = (renderScorecard as any)({ matchUp: matchUps[0], participantFilter });
    if (scorecard && drawsView) {
      drawsView.appendChild(scorecard);
    }
  } else {
    updateDrawDisplay();
  }

  updateControlBar();
}
