import { displayAllEvents } from 'components/tables/eventsTable/displayAllEvents';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { tournamentEngine } from 'services/factory/engine';

import { ALL_EVENTS } from 'constants/tmxConstants';

export function getEventOptions(): { eventOptions: any[] } {
  const events = tournamentEngine.q.events() ?? [];

  // Mixed-shape menu items (event options + a divider + an "all events" entry)
  // — explicit `any[]` so the map result stays loose enough for the trailing
  // `.concat` that adds a divider and a styled label.
  const eventOptions: any[] = events
    .map((event: any) => {
      return {
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
        close: true,
      };
    })
    .concat([
      { divider: true },
      { label: `<div style='font-weight: bold'>${ALL_EVENTS}</div>`, onClick: displayAllEvents, close: true },
    ] as any[]);

  return { eventOptions };
}
