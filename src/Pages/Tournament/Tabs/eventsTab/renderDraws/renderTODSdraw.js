import { tournamentEngine, drawDefinitionConstants, eventConstants, utilities } from 'tods-competition-factory';
import { renderScorecard } from 'components/overlays/scorecard/scorecard';
import { removeAllChildNodes } from 'services/dom/transformers';
import { controlBar } from 'components/controlBar/controlBar';
import { destroyTables } from 'Pages/Tournament/destroyTable';
import { getStructureOptions } from './getStructureOptions';
import { generateQualifying } from './generateQualifying';
import { getEventHandlers } from '../getEventHandlers';
import { getActionOptions } from './getActionOptions';
import { Draw, compositions } from 'tods-score-grid';
import { getEventOptions } from './getEventOptions';
import { getDrawsOptions } from './getDrawsOptions';
import { DrawStructure } from 'tods-react-draws';
import { context } from 'services/context';

import { render, unmountComponentAtNode } from 'react-dom';

import { DRAWS_VIEW, EVENT_CONTROL, LEFT, QUALIFYING, RIGHT } from 'constants/tmxConstants';

const { AD_HOC } = drawDefinitionConstants;
const { DOUBLES, TEAM } = eventConstants;

export function renderTODSdraw({ eventId, drawId, structureId, compositionName }) {
  const events = tournamentEngine.getEvents().events;
  if (!events?.length) return;

  let participantFilter, eventData, eventType, drawData, structures;

  const getData = () => {
    eventData = tournamentEngine.getEventData({ eventId }).eventData;
    eventType = eventData?.eventInfo?.eventType;
    drawData = eventData?.drawsData?.find((data) => data.drawId === drawId);
    structures = drawData?.structures || [];
    structureId = structureId || structures?.[0]?.structureId;
  };

  getData();

  const { roundMatchUps, stage } = utilities.makeDeepCopy(
    drawData?.structures?.find((s) => s.structureId === structureId) || {}
  );
  const matchUps = Object.values(roundMatchUps || {}).flat();
  const dual = matchUps?.length === 1 && eventData.eventInfo.eventType === TEAM;

  const eventHandlers = getEventHandlers({
    callback: () => renderTODSdraw({ eventId, drawId, structureId }),
    eventData
  });
  const composition =
    compositions?.[compositionName] ||
    compositions[(eventType === DOUBLES && 'Australian') || (eventType === TEAM && 'French') || 'National']; // National malformed for DOUBLES

  const className = composition.theme;
  composition.configuration.allDrawPositions = true;
  composition.configuration.drawPositions = true;

  const args = {
    eventHandlers,
    structureId,
    eventData,
    drawId
  };

  const drawsView = document.getElementById(DRAWS_VIEW);
  destroyTables();
  unmountComponentAtNode(drawsView);
  removeAllChildNodes(drawsView);

  const updateDrawDisplay = (args) => {
    if (dual) return;
    for (const structure of structures) {
      for (const key of Object.keys(structure.roundMatchUps)) {
        structure.roundMatchUps[key] = roundMatchUps?.[key]?.filter(
          ({ sides }) =>
            sides?.some(({ participant }) => participant?.participantName.toLowerCase().includes(participantFilter)) ||
            !participantFilter
        );
      }
    }

    if (!matchUps.length) {
      if (stage === QUALIFYING) {
        generateQualifying({ drawData, drawId, eventId });
        /*
        const button = document.createElement('button');
        button.onclick = (e) => {
          e.stopPropagation();
          e.preventDefault();
          const drawName = drawData.drawName;
          addDraw({
            callback: (result) => {
              const structureId = result.drawDefinition?.structures?.find(
                ({ stage }) => stage === QUALIFYING
              )?.structureId;
              navigateToEvent({ eventId, drawId, structureId, renderDraw: true });
            },
            isQualifying: true,
            drawName,
            eventId,
            drawId
          });
        };
        button.className = 'button is-info';
        button.innerHTML = 'Generate qualifying';
        drawsView.appendChild(button);
        */
      } else {
        console.log(AD_HOC, { structureId, structures, drawData });
      }
    } else {
      window.reactDraws
        ? render(<DrawStructure {...args} />, drawsView)
        : render(
            <Draw
              searchActive={participantFilter}
              eventHandlers={eventHandlers}
              structureId={structureId}
              composition={composition}
              structures={structures}
              className={className}
              disableFlags={true}
            />,
            drawsView
          );
    }
  };

  const eventControlElement = document.getElementById(EVENT_CONTROL);
  const updateControlBar = (refresh) => {
    if (refresh) getData();

    const structureName = drawData?.structures?.find((s) => s.structureId === structureId)?.structureName;
    const actionOptions = getActionOptions({ eventData, drawData, drawId, structureId, structureName });
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
      args.nameFilter = value; // tods-react-draws
      updateDrawDisplay(args);
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
    if (scorecard) drawsView.appendChild(scorecard);
  } else {
    updateDrawDisplay(args);
  }

  updateControlBar();
}
