import { eventConstants, tournamentEngine, tools } from 'tods-competition-factory';
import { controlBar } from 'components/controlBar/controlBar';
import { getStructureOptions } from '../getStructureOptions';
import { getActionOptions } from '../getActionOptions';
import { getEventOptions } from '../getEventOptions';
import { getDrawsOptions } from '../getDrawsOptions';
import { context } from 'services/context';

import { RIGHT, LEFT, EVENT_CONTROL } from 'constants/tmxConstants';
const { TEAM } = eventConstants;

export function eventControlBar({ eventId, drawId, structureId, updateDisplay }) {
  const eventData = tournamentEngine.getEventData({ eventId }).eventData;
  const drawData = eventData?.drawsData?.find((data) => data.drawId === drawId);
  const structures = drawData?.structures || [];
  structureId = structureId || structures?.[0]?.structureId;
  const structure = structures.find((s) => s.structureId === structureId);
  const { roundMatchUps } = tools.makeDeepCopy(structure || {});
  const matchUps = Object.values(roundMatchUps || {}).flat();
  const dual = matchUps?.length === 1 && eventData.eventInfo.eventType === TEAM;

  const structureOptions = getStructureOptions({
    updateControlBar: () => eventControlBar({ eventId, drawId, structureId, updateDisplay }),
    structureId,
    drawData,
    eventId,
  });
  const drawsOptions = getDrawsOptions({ eventData, drawId });
  const { eventOptions } = getEventOptions({ eventId, drawId });

  const structureName = drawData?.structures?.find((s) => s.structureId === structureId)?.structureName;
  const actionOptions = getActionOptions({
    dualMatchUp: dual && matchUps[0],
    structureName,
    structureId,
    eventData,
    drawData,
    drawId,
  });

  // PARTICIPANT filter
  let participantFilter;

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
    if (typeof updateDisplay === 'function') updateDisplay({ participantFilter });
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

  const eventControlElement = document.getElementById(EVENT_CONTROL);
  controlBar({ target: eventControlElement, items });
}
