import { highlightTeam, removeTeamHighlight } from 'services/dom/events/teamHighlights';
import { compositions, renderContainer, renderStructure } from 'courthive-components';
import { createRoundsTable } from 'components/tables/roundsTable/createRoundsTable';
import { tournamentEngine, eventConstants, tools } from 'tods-competition-factory';
import { createStatsTable } from 'components/tables/statsTable/createStatsTable';
import { getEventControlItems } from './eventControlBar/eventControlItems';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { renderScorecard } from 'components/overlays/scorecard/scorecard';
import { removeAllChildNodes } from 'services/dom/transformers';
import { eventManager } from 'services/dom/events/eventManager';
import { controlBar } from 'components/controlBar/controlBar';
import { destroyTables } from 'pages/tournament/destroyTable';
import { generateAdHocRound } from './generateAdHocRound';
import { generateQualifying } from './generateQualifying';
import { findAncestor } from 'services/dom/parentAndChild';
import { cleanupDrawPanel } from '../cleanupDrawPanel';
import { getEventHandlers } from '../getEventHandlers';
import { drawControlBar } from './drawControlBar';
import { context } from 'services/context';
import { env } from 'settings/env';
import morphdom from 'morphdom';

import { EVENT_CONTROL, DRAWS_VIEW, QUALIFYING, ROUNDS_TABLE, ROUNDS_STATS } from 'constants/tmxConstants';

const { DOUBLES, TEAM } = eventConstants;

export function renderDrawView({ eventId, drawId, structureId, roundsView, redraw }) {
  const events = tournamentEngine.getEvents().events;
  if (!events?.length) return;
  let isAdHoc;

  // eventManager.register('tmx-m', 'mouseover', () => console.log('tmx-m'));
  eventManager.register('tmx-tm', 'mouseover', highlightTeam);
  eventManager.register('tmx-tm', 'mouseout', removeTeamHighlight);

  let participantFilter, roundMatchUps, structures, eventData, eventType, structure, drawData, matchUps, stage;

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
    drawData = eventData?.drawsData?.find((data) => data.drawId === drawId);
    structures = drawData?.structures || [];
    structureId = structureId || structures?.[0]?.structureId;
    structure = structures.find((s) => s.structureId === structureId);
    isAdHoc = tournamentEngine.isAdHoc({ structure });
    ({ roundMatchUps, stage } = tools.makeDeepCopy(structure || {}));
    matchUps = Object.values(roundMatchUps || {}).flat();
    if (isAdHoc) matchUps.sort(tools.matchUpScheduleSort);
  };

  destroyTables();
  getData();

  const callback = (params) => {
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
  composition.configuration.flags = false;
  Object.assign(composition.configuration, configuration);

  // override WTN default
  if (composition.configuration.scaleAttributes) {
    composition.configuration.scaleAttributes = env.scales[env.activeScale];
  }

  if (!env.composition) {
    composition.configuration.genderColor = true;
    composition.configuration.showAddress = undefined;
    // composition.configuration.participantDetail = 'TEAM';
    // composition.configuration.participantDetail = 'ADDRESS';
    // composition.configuration.participantDetail = '_ustaSection.name';
    // composition.configuration.participantDetail = 'sex';

    composition.configuration.allDrawPositions = true;
    composition.configuration.drawPositions = true;
  }
  composition.configuration.roundHeader = true;

  const drawsView = document.getElementById(DRAWS_VIEW);
  if (redraw) removeAllChildNodes(drawsView);

  const updateDrawDisplay = () => {
    if (dual) return;

    // FILTER: participantFilter used to filter matchUps from all rounds in target structure
    for (const key of Object.keys(structure?.roundMatchUps ?? {})) {
      structure.roundMatchUps[key] = roundMatchUps?.[key]?.filter(({ sides }) => {
        const hasParticipant = sides?.some(({ participant }) =>
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
      createRoundsTable({ matchUps: displayMatchUps, eventData });
    } else if (roundsView === ROUNDS_STATS) {
      createStatsTable({ eventId, drawId, structureId });
    } else {
      // const finalColumn = getFinalColumn({ structure, drawId, callback });
      const content = renderContainer({
        content: renderStructure({
          context: { drawId, structureId },
          searchActive: participantFilter,
          matchUps: displayMatchUps,
          // initialRoundNumber: 3,
          eventHandlers,
          composition,
          // finalColumn,
        }),
        theme: composition.theme,
      });

      const getTMXp = (node) => {
        if (node?.classList?.contains('tmx-p')) return node;
        return findAncestor(node, 'tmx-p');
      };
      const targetNode = drawsView.firstChild;
      if (targetNode) {
        morphdom(targetNode, content, {
          addChild: function (parentNode, childNode) {
            if (childNode.classList) {
              const existing = parentNode.firstChild;
              const incomingIdValue = childNode.getAttribute('id');
              const incomingId = ![null, 'undefined', undefined].includes(incomingIdValue);
              const existingIdValue = parentNode.firstChild?.getAttribute?.('id');
              const existingId = ![null, 'undefined', undefined].includes(existingIdValue);

              try {
                if (!incomingId && !existingId) {
                  if (env.renderLog) console.log('condition 0');
                  const nextSibling = getTMXp(existing)?.nextSibling;
                  if (nextSibling?.getAttribute('id') && getTMXp(existing)?.getAttribute('id')) {
                    nextSibling.parentElement.removeChild(nextSibling);
                  }
                  // return false;
                } else if (
                  incomingId &&
                  existingId &&
                  incomingIdValue &&
                  existingIdValue &&
                  incomingIdValue !== existingIdValue
                ) {
                  if (env.renderLog) console.log('condition 1');
                  parentNode.removeChild(parentNode.firstChild);
                } else if (childNode.classList?.contains('tmx-p') && !existingId) {
                  if (env.renderLog) console.log('condition 2');
                  parentNode.removeChild(parentNode.firstChild);
                } else if (
                  parentNode.firstChild?.classList?.contains('tmx-p') &&
                  parentNode.firstChild.getAttribute('id') !== 'undefined' &&
                  childNode.getAttribute('id') === 'undefined'
                ) {
                  if (env.renderLog) console.log('condition 3');
                  parentNode.removeChild(parentNode.firstChild);
                } else if (!incomingId && existingId) {
                  if (env.renderLog) console.log('condition 4');
                } else {
                  console.log({ incomingId, existingId, incomingIdValue, existingIdValue });
                }
              } catch (err) {
                console.log({ err });
              }
            }
            parentNode.appendChild(childNode);
          },
        });
      } else {
        drawsView.appendChild(content);
      }
    }
  };

  const update = () => {
    getData();
    updateDrawDisplay();
  };
  drawControlBar({ updateDisplay: update, drawId, structure, existingView: roundsView, callback });
  const eventControlElement = document.getElementById(EVENT_CONTROL);
  const updateControlBar = (refresh) => {
    if (refresh) getData();

    // PARTICIPANT filter
    const searchFilter = (rowData) => rowData.searchText?.includes(participantFilter);
    const updateParticipantFilter = (value) => {
      if (!value) {
        Object.values(context.tables)
          .filter(Boolean)
          // TODO: update this search logic!
          // .forEach((table) => table.removeFilter(searchFilter));
          .forEach((table) => table.clearFilter());
      }
      participantFilter = value?.toLowerCase();
      if (value) {
        Object.values(context.tables)
          .filter(Boolean)
          .forEach((table) => table.addFilter(searchFilter));
      }
      removeAllChildNodes(drawsView);
      updateDrawDisplay();
    };

    const items = getEventControlItems({
      updateParticipantFilter,
      updateControlBar,
      structureId,
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

  structureId = structureId || drawData.structures?.[0]?.structureId;
  if (!structureId) {
    console.log('structure not found');
    return;
  }

  if (dual) {
    const scorecard = renderScorecard({ matchUp: matchUps[0], participantFilter });
    if (scorecard) {
      drawsView.appendChild(scorecard);
    }
  } else {
    updateDrawDisplay();
  }

  updateControlBar();
}
