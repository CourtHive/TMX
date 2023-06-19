import { displayAllEvents } from 'components/tables/eventsTable/displayAllEvents';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { controlBar } from 'components/controlBar/controlBar';
import { tournamentEngine } from 'tods-competition-factory';
import { getValidActions } from 'functions/drawActions';
import { DrawStructure } from 'tods-react-draws';
import { render } from 'react-dom';

import { DRAWS_VIEW, EVENT_CONTROL, LEFT, RIGHT } from 'constants/tmxConstants';

export function renderTODSdraw({ eventId, drawId, structureId }) {
  let eventData = tournamentEngine.getEventData({ eventId }).eventData;
  const events = tournamentEngine.getEvents().events;
  if (!events?.length) return;

  let drawData = eventData?.drawsData?.find((data) => data.drawId === drawId);
  const eventControlElement = document.getElementById(EVENT_CONTROL);
  const eventHandlers = {
    onScheduleClick: (props) => console.log('Schedule', props),
    onRoundNameClick: (props) => console.log('Round Name', props),
    onScoreClick: (props) => console.log('Scoring', props),
    onHeaderClick: (props) => console.log('header', props),
    onStatsClick: (props) => console.log('stats', props),
    onParticipantClick: (params) =>
      getValidActions({ ...params, callback: () => renderTODSdraw({ eventId, drawId, structureId }) })
  };

  let args = {
    // dictionary: {},
    eventHandlers,
    structureId,
    eventData,
    drawId
  };

  const updateDrawDisplay = (args) => render(<DrawStructure {...args} />, document.getElementById(DRAWS_VIEW));
  const updateControlBar = () => {
    const eventOptions = events
      .map((event) => ({
        onClick: () => {
          const result = tournamentEngine.getEventData({ eventId: event.eventId });
          if (!result.eventData?.drawsData?.length) {
            navigateToEvent({ eventId: event.eventId });
          } else {
            eventData = result.eventData;
            drawId = eventData.drawsData?.[0]?.drawId;
            navigateToEvent({ eventId: eventData.eventInfo.eventId, drawId, renderDraw: true });
          }
        },
        label: event.eventName,
        close: true
      }))
      .concat([
        { divider: true },
        { label: `<div style='font-weight: bold'>All events</div>`, onClick: displayAllEvents, close: true }
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
        label: structure.structureName,
        close: true
      }))
      .concat([
        { divider: true },
        { heading: 'Add structure(s)', onClick: () => console.log('option to add structure(s)') }
      ]);

    // PARTICIPANT filter
    const updateParticipantFilter = (value) => {
      args.nameFilter = value;
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
        label: structure.structureName,
        modifyLabel: true,
        location: LEFT
      },
      {
        onClick: () => navigateToEvent({ eventId, drawId }),
        label: 'View entries',
        intent: 'is-info',
        location: RIGHT
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

  const structure = drawData.structures?.find((s) => s.structureId === structureId);

  updateDrawDisplay(args);
  updateControlBar();
}
