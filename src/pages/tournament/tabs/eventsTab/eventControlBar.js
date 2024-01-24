import { DRAWS_VIEW, EVENT_CONTROL, LEFT, RIGHT } from 'constants/tmxConstants';
import { getActionOptions } from './renderDraws/getActionOptions';
import { getStructureOptions } from './renderDraws/getStructureOptions';
import { getDrawsOptions } from './renderDraws/getDrawsOptions';
import { getEventOptions } from './renderDraws/getEventOptions';
import { removeAllChildNodes } from 'services/dom/transformers';
import { controlBar } from 'components/controlBar/controlBar';
import { context } from 'services/context';

export function updateControlBar({ refresh, structureId, updateDrawDisplay, participantFilter }) {
  const eventControlElement = document.getElementById(EVENT_CONTROL);
  const drawsView = document.getElementById(DRAWS_VIEW);
  // if (refresh) getData();

  const structureName = drawData?.structures?.find((s) => s.structureId === structureId)?.structureName;
  const actionOptions = getActionOptions({
    dualMatchUp: dual && matchUps[0],
    structureName,
    structureId,
    eventData,
    drawData,
    drawId,
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
    if (updateDrawDisplay) {
      removeAllChildNodes(drawsView);
      updateDrawDisplay();
    }
  };

  const items = [
    {
      onKeyDown: (e) => e.keyCode === 8 && e.target.value.length === 1 && updateParticipantFilter(''),
      onChange: (e) => updateParticipantFilter(e.target.value),
      onKeyUp: (e) => updateParticipantFilter(e.target.value),
      clearSearch: () => updateParticipantFilter(''),
      placeholder: 'Participant name',
      location: LEFT,
      search: true,
    },
    {
      options: eventOptions.length > 1 ? eventOptions : undefined,
      label: eventData.eventInfo.eventName,
      modifyLabel: true,
      location: LEFT,
    },
    {
      options: drawsOptions.length > 1 ? drawsOptions : undefined,
      label: drawData.drawName,
      modifyLabel: true,
      location: LEFT,
    },
    {
      options: structureOptions.length > 1 ? structureOptions : undefined,
      label: structureName,
      modifyLabel: true,
      location: LEFT,
    },
    {
      options: actionOptions,
      intent: 'is-info',
      label: 'Actions',
      location: RIGHT,
      align: RIGHT,
    },
  ];

  controlBar({ target: eventControlElement, items });

  return { participantFilter };
}
