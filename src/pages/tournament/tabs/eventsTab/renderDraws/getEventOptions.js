import { displayAllEvents } from 'components/tables/eventsTable/displayAllEvents';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { tournamentEngine } from 'tods-competition-factory';

import { ALL_EVENTS } from 'constants/tmxConstants';

export function getEventOptions({ events }) {
  return events
    .map((event) => ({
      onClick: () => {
        const result = tournamentEngine.getEventData({ eventId: event.eventId });
        if (!result?.eventData?.drawsData?.length) {
          navigateToEvent({ eventId: event.eventId });
        } else {
          const drawId = result.eventData.drawsData?.[0]?.drawId;
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
}
