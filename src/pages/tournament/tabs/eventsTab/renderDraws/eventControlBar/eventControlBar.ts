/**
 * Event draw control bar with participant filtering.
 * Renders control bar with search and actions for event draw views.
 */
import { tournamentEngine, tools } from 'tods-competition-factory';
import { controlBar } from 'components/controlBar/controlBar';
import { getEventControlItems } from './eventControlItems';
import { context } from 'services/context';

import { EVENT_CONTROL } from 'constants/tmxConstants';

export function eventControlBar({ eventId, drawId, structureId, updateDisplay }: { eventId: string; drawId: string; structureId?: string; updateDisplay?: (args: any) => void }): void {
  const eventData = tournamentEngine.getEventData({ eventId }).eventData;
  const drawData = eventData?.drawsData?.find((data: any) => data.drawId === drawId);
  const structures = drawData?.structures || [];
  structureId = structureId || structures?.[0]?.structureId;
  const structure = structures.find((s: any) => s.structureId === structureId);
  const { roundMatchUps } = tools.makeDeepCopy(structure || {});
  const matchUps = Object.values(roundMatchUps || {}).flat();

  let participantFilter: string | undefined;

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
    if (typeof updateDisplay === 'function') updateDisplay({ participantFilter });
  };

  const items = (getEventControlItems as any)({
    updateControlBar: eventControlBar,
    updateParticipantFilter,
    structureId,
    eventData,
    drawData,
    matchUps,
    eventId,
    drawId,
  });

  const eventControlElement = document.getElementById(EVENT_CONTROL) || undefined;
  controlBar({ target: eventControlElement, items });
}
