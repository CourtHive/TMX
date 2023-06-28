import { displayAllEvents } from 'components/tables/eventsTable/displayAllEvents';
import { tournamentEngine, eventConstants, utilities } from 'tods-competition-factory';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { removeAllChildNodes } from 'services/dom/transformers';
import { renderScorecard } from 'components/overlays/scorecard';
import { controlBar } from 'components/controlBar/controlBar';
import { destroyTables } from 'Pages/Tournament/destroyTable';
import { render, unmountComponentAtNode } from 'react-dom';
import { getEventHandlers } from './getEventHandlers';
import { Draw, compositions } from 'tods-score-grid';
import { DrawStructure } from 'tods-react-draws';
import { context } from 'services/context';

import { ALL_EVENTS, DRAWS_VIEW, EVENT_CONTROL, LEFT, RIGHT } from 'constants/tmxConstants';
import { DELETE_FLIGHT_AND_DRAW } from 'constants/mutationConstants';

const { DOUBLES, TEAM } = eventConstants;

export function renderTODSdraw({ eventId, drawId, structureId, compositionName }) {
  const eventData = tournamentEngine.getEventData({ eventId }).eventData;
  const events = tournamentEngine.getEvents().events;
  if (!events?.length) return;

  let participantFilter;

  const eventType = eventData?.eventInfo?.eventType;

  const drawData = eventData?.drawsData?.find((data) => data.drawId === drawId);
  const structures = drawData?.structures || [];
  structureId = structureId || structures?.[0]?.structureId;

  const { structureName, roundMatchUps } = utilities.makeDeepCopy(
    drawData.structures?.find((s) => s.structureId === structureId) || {}
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
        structure.roundMatchUps[key] = roundMatchUps[key].filter(
          ({ sides }) =>
            sides.some(({ participant }) => participant?.participantName.toLowerCase().includes(participantFilter)) ||
            !participantFilter
        );
      }
    }

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
  };

  const eventControlElement = document.getElementById(EVENT_CONTROL);
  const updateControlBar = () => {
    const eventOptions = events
      .map((event) => ({
        onClick: () => {
          const result = tournamentEngine.getEventData({ eventId: event.eventId });
          if (!result.eventData?.drawsData?.length) {
            navigateToEvent({ eventId: event.eventId });
          } else {
            drawId = result.eventData.drawsData?.[0]?.drawId;
            navigateToEvent({ eventId: result.eventData.eventInfo.eventId, drawId, renderDraw: true });
          }
        },
        label: event.eventName,
        close: true
      }))
      .concat([
        { divider: true },
        { label: `<div style='font-weight: bold'>${ALL_EVENTS}</div>`, onClick: displayAllEvents, close: true }
      ]);

    const drawsOptions = eventData.drawsData
      .map((draw) => ({
        onClick: () => {
          const drawId = draw.drawId;
          const structureId = draw.structures?.[0]?.structureId;
          navigateToEvent({ eventId, drawId, structureId, renderDraw: true });
        },
        label: draw.drawName,
        close: true
      }))
      .concat([{ divider: true }, { heading: 'Add flight', onClick: () => console.log('Add new flight') }]);

    const structureOptions = drawData.structures
      .map((structure) => ({
        onClick: () => {
          navigateToEvent({ eventId, drawId, structureId: structure.structureId, renderDraw: true });
        },
        label: structureName,
        close: true
      }))
      .concat([
        { divider: true },
        { heading: 'Add structure(s)', onClick: () => console.log('option to add structure(s)') }
      ]);

    // PARTICIPANT filter
    const searchFilter = (rowData) => rowData.searchText?.includes(participantFilter);
    const updateParticipantFilter = (value) => {
      if (!value) {
        Object.values(context.tables)
          .filter(Boolean)
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

    const deleteDraw = () => {
      const methods = [{ method: DELETE_FLIGHT_AND_DRAW, params: { eventId, drawId } }];
      const postMutation = (result) => result.success && navigateToEvent({ eventId });
      mutationRequest({ methods, callback: postMutation });
    };

    const actionOptions = [
      {
        onClick: () => navigateToEvent({ eventId, drawId }),
        label: 'View entries'
      },
      {
        onClick: deleteDraw,
        label: 'Delete draw'
      }
    ];

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
