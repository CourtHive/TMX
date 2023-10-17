import { tournamentEngine, drawDefinitionConstants, eventConstants, utilities } from 'tods-competition-factory';
import { compositions, renderContainer, renderStructure } from 'courthive-components';
import { renderScorecard } from 'components/overlays/scorecard/scorecard';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { removeAllChildNodes } from 'services/dom/transformers';
import { eventManager } from 'services/dom/events/eventManager';
import { controlBar } from 'components/controlBar/controlBar';
import { destroyTables } from 'Pages/Tournament/destroyTable';
import { getStructureOptions } from './getStructureOptions';
import { generateQualifying } from './generateQualifying';
import { getAdHocActions } from '../actions/adHocActions';
import { cleanupDrawPanel } from '../cleanupDrawPanel';
import { getEventHandlers } from '../getEventHandlers';
import { getActionOptions } from './getActionOptions';
import { getEventOptions } from './getEventOptions';
import { getDrawsOptions } from './getDrawsOptions';
import { context } from 'services/context';
import morphdom from 'morphdom';

import { EVENT_CONTROL, DRAW_CONTROL, DRAWS_VIEW, QUALIFYING, RIGHT, LEFT, NONE } from 'constants/tmxConstants';
import { AUTOMATED_PLAYOFF_POSITIONING } from 'constants/mutationConstants';

const { DOUBLES, TEAM } = eventConstants;

export function renderTODSdraw({ eventId, drawId, structureId, compositionName }) {
  const events = tournamentEngine.getEvents().events;
  if (!events?.length) return;

  eventManager.register('tmx-m', 'mouseover', () => console.log('tmx-m'));

  const displayConfig = tournamentEngine.findTournamentExtension({ name: 'DISPLAY' })?.value;
  console.log({ drawId, displayConfig });

  let participantFilter, eventData, eventType, drawData, structures, structure, stage, roundMatchUps, matchUps;

  const getData = () => {
    eventData = tournamentEngine.getEventData({
      participantsProfile: { withIOC: true, withISO2: true, withScaleValues: true, withGroupings: true },
      includePositionAssignments: true,
      eventId
    })?.eventData;
    eventType = eventData?.eventInfo?.eventType;
    drawData = eventData?.drawsData?.find((data) => data.drawId === drawId);
    structures = drawData?.structures || [];
    structureId = structureId || structures?.[0]?.structureId;
    structure = structures.find((s) => s.structureId === structureId);
    ({ roundMatchUps, stage } = utilities.makeDeepCopy(structure || {}));
    matchUps = Object.values(roundMatchUps || {}).flat();
  };

  destroyTables();
  getData();

  // once we have data...
  const { sourceStructuresComplete, hasDrawFeedProfile } = structure ?? {};
  const isPlayoff =
    !(structure?.stage === 'MAIN' && structure?.stageSequence === 1) &&
    structure?.stage !== 'QUALIFYING' &&
    hasDrawFeedProfile;

  const isRoundRobin = structure?.structureType === 'CONTAINER';

  const callback = () => {
    cleanupDrawPanel();
    renderTODSdraw({ eventId, drawId, structureId });
  };
  const dual = matchUps?.length === 1 && eventData.eventInfo.eventType === TEAM;
  const eventHandlers = getEventHandlers({
    eventData,
    callback,
    drawId
  });
  const composition =
    compositions?.[compositionName] ||
    compositions[(eventType === DOUBLES && 'National') || (eventType === TEAM && 'Basic') || 'National'];

  // override WTN default
  if (composition.configuration.scaleAttributes) {
    composition.configuration.scaleAttributes.scaleName = 'UTR';
    composition.configuration.scaleAttributes.accessor = 'utrRating';
    // composition.configuration.scaleAttributes.scaleName = 'WTN';
    // composition.configuration.scaleAttributes.accessor = 'wtnRating';
    composition.configuration.scaleAttributes.scaleColor = 'blue';
    composition.configuration.scaleAttributes.fallback = true;
  }

  composition.configuration.showAddress = undefined;
  composition.configuration.participantDetail = 'TEAM';

  composition.configuration.allDrawPositions = true;
  composition.configuration.drawPositions = true;
  composition.configuration.roundHeader = true;

  const drawsView = document.getElementById(DRAWS_VIEW);

  const updateDrawDisplay = () => {
    if (dual) return;

    if (isPlayoff) {
      const playoffPositioning = () => {
        const method = {
          params: { structureId: structure.sourceStructureIds[0], drawId },
          method: AUTOMATED_PLAYOFF_POSITIONING
        };
        const postMutation = (result) => {
          if (result.success) {
            getData();
            updateDrawDisplay();
          }
        };
        mutationRequest({ methods: [method], callback: postMutation });
      };

      const hasAssignedPositions = structure.positionAssignments?.filter(({ participantId }) => participantId).length;
      const drawControlItems = [
        {
          intent: sourceStructuresComplete ? 'is-primary' : NONE,
          disabled: sourceStructuresComplete !== true,
          visible: !hasAssignedPositions,
          onClick: playoffPositioning,
          label: 'Auto position',
          location: RIGHT
        }
      ];
      const drawControl = document.getElementById(DRAW_CONTROL);
      controlBar({ target: drawControl, items: drawControlItems });
    } else if (isRoundRobin) {
      // when all matcheUps have been scored (structure is complete) auto-switch to finishing position/stats view
      // if there are playoff structures, button to populate them
      const roundRobinStats = {
        onClick: () => console.log('boo'),
        label: 'View stats', // also toggle between finishing positions and matches
        location: RIGHT
      };

      const drawControlItems = [roundRobinStats];
      const drawControl = document.getElementById(DRAW_CONTROL);
      controlBar({ target: drawControl, items: drawControlItems });
    } else if (utilities.isAdHoc({ structure })) {
      const adHocActions = getAdHocActions({ structure, drawId, callback });
      const drawControlItems = adHocActions;
      const drawControl = document.getElementById(DRAW_CONTROL);
      controlBar({ target: drawControl, items: drawControlItems });
    } else if (structure.stage === drawDefinitionConstants.VOLUNTARY_CONSOLATION) {
      console.log('voluntary controlBar with [View participants]');
      // use modal with eligible players and selected players highlighted
    }

    // FILTER: participantFilter used to filter matchUps from all rounds in target structure
    for (const key of Object.keys(structure.roundMatchUps)) {
      structure.roundMatchUps[key] = roundMatchUps?.[key]?.filter(({ sides }) => {
        const hasParticipant = sides?.some(({ participant }) =>
          participant?.participantName.toLowerCase().includes(participantFilter)
        );
        return hasParticipant || !participantFilter;
      });
    }

    if (!matchUps.length) {
      if (stage === QUALIFYING) {
        generateQualifying({ drawData, drawId, eventId });
      } else {
        console.log('no matchUps', { structureId, structures, drawData });
        removeAllChildNodes(drawsView);
      }
    } else {
      const filteredMatchUps = Object.values(structure.roundMatchUps || {}).flat();
      // removeAllChildNodes(drawsView);

      // const finalColumn = getFinalColumn({ structure, drawId, callback });

      const content = renderContainer({
        content: renderStructure({
          context: { drawId, structureId },
          searchActive: participantFilter,
          matchUps: filteredMatchUps,
          eventHandlers,
          composition,
          // finalColumn,
          structure
        }),
        theme: composition.theme
      });

      const targetNode = drawsView.firstChild;
      if (targetNode) {
        morphdom(targetNode, content, {
          addChild: function (parentNode, childNode) {
            if (childNode.classList) {
              try {
                if (
                  childNode.getAttribute('id') !== 'undefined' &&
                  parentNode.firstChild.getAttribute('id') !== 'undefined' &&
                  childNode.getAttribute('id') !== parentNode.firstChild.getAttribute('id')
                ) {
                  // parentNode.removeChild(parentNode.firstChild);
                } else {
                  if (
                    childNode.classList?.contains('tmx-p') &&
                    parentNode.firstChild.getAttribute('id') === 'undefined'
                  ) {
                    parentNode.removeChild(parentNode.firstChild);
                  }
                  if (
                    parentNode.firstChild?.classList?.contains('tmx-p') &&
                    parentNode.firstChild.getAttribute('id') !== 'undefined' &&
                    childNode.getAttribute('id') === 'undefined'
                  ) {
                    parentNode.removeChild(parentNode.firstChild);
                  }
                }
              } catch (err) {
                console.log({ err });
              }
            }
            parentNode.appendChild(childNode);
          }
        });
      } else {
        drawsView.appendChild(content);
      }
    }
  };

  const eventControlElement = document.getElementById(EVENT_CONTROL);
  const updateControlBar = (refresh) => {
    if (refresh) getData();

    const structureName = drawData?.structures?.find((s) => s.structureId === structureId)?.structureName;
    const actionOptions = getActionOptions({
      dualMatchUp: dual && matchUps[0],
      structureName,
      structureId,
      eventData,
      drawData,
      drawId
    });
    const structureOptions = getStructureOptions({ drawData, eventId, structureId, updateControlBar });
    const drawsOptions = getDrawsOptions({ eventData, drawId });
    const eventOptions = getEventOptions({ events });

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
      updateDrawDisplay();
    };

    const items = [
      {
        onKeyDown: (e) => e.keyCode === 8 && e.target.value.length === 1 && updateParticipantFilter(''),
        onChange: (e) => updateParticipantFilter(e.target.value),
        onKeyUp: (e) => updateParticipantFilter(e.target.value),
        placeholder: 'Participant name',
        location: LEFT
      },
      {
        options: eventOptions.length > 1 ? eventOptions : undefined,
        label: eventData.eventInfo.eventName,
        modifyLabel: true,
        location: LEFT
      },
      {
        options: drawsOptions.length > 1 ? drawsOptions : undefined,
        label: drawData.drawName,
        modifyLabel: true,
        location: LEFT
      },
      {
        options: structureOptions.length > 1 ? structureOptions : undefined,
        label: structureName,
        modifyLabel: true,
        location: LEFT
      },
      {
        options: actionOptions,
        intent: 'is-info',
        label: 'Actions',
        location: RIGHT,
        align: RIGHT
      }
    ];

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
