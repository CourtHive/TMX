import { tournamentEngine } from 'tods-competition-factory';

import { ALL_EVENTS } from 'constants/tmxConstants';

export function getEventFilter(table) {
  let filterValue;

  const eventFilter = (rowData) => rowData.eventIds.includes(filterValue);
  const updateEventFilter = (eventId) => {
    if (filterValue) table.removeFilter(eventFilter);
    filterValue = eventId;
    if (eventId) table.addFilter(eventFilter);
  };
  const events = tournamentEngine.getEvents().events || [];
  const allEvents = { label: ALL_EVENTS, onClick: updateEventFilter, close: true };
  const eventOptions = [allEvents].concat(
    events.map((event) => ({
      onClick: () => updateEventFilter(event.eventId),
      label: event.eventName,
      close: true
    }))
  );

  return { eventOptions, events };
}
