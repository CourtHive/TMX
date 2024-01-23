import { tournamentEngine, tools } from 'tods-competition-factory';
import { controlBar } from 'components/controlBar/controlBar';
import { getEventControlItems } from './eventControlItems';
import { context } from 'services/context';

import { EVENT_CONTROL } from 'constants/tmxConstants';

export function eventControlBar({ eventId, drawId, structureId, updateDisplay }) {
  const eventData = tournamentEngine.getEventData({ eventId }).eventData;
  const drawData = eventData?.drawsData?.find((data) => data.drawId === drawId);
  const structures = drawData?.structures || [];
  structureId = structureId || structures?.[0]?.structureId;
  const structure = structures.find((s) => s.structureId === structureId);
  const { roundMatchUps } = tools.makeDeepCopy(structure || {});
  const matchUps = Object.values(roundMatchUps || {}).flat();

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

  const items = getEventControlItems({
    updateControlBar: eventControlBar,
    updateParticipantFilter,
    structureId,
    eventData,
    drawData,
    matchUps,
    eventId,
    drawId,
  });

  const eventControlElement = document.getElementById(EVENT_CONTROL);
  controlBar({ target: eventControlElement, items });
}
