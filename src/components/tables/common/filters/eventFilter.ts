import { tournamentEngine } from 'tods-competition-factory';
import { t } from 'i18n';

import { NONE } from 'constants/tmxConstants';

export function getEventFilter(table: any): {
  events: { eventId: string; eventName: string }[];
  eventOptions: any[];
} {
  let filterValue;

  const eventFilter = (rowData) =>
    filterValue === NONE ? !rowData?.eventIds?.length : rowData?.eventIds?.includes(filterValue);
  const updateEventFilter = (eventId?) => {
    table.removeFilter(eventFilter);
    filterValue = eventId;
    if (eventId) table.addFilter(eventFilter);
  };
  const events = tournamentEngine.getEvents().events || [];
  const allEventsLabel = t('pages.participants.allEvents');
  const noEventsLabel = t('pages.participants.noEvents');
  const allEvents = {
    label: `<span style='font-weight: bold'>${allEventsLabel}</span>`,
    onClick: () => updateEventFilter(),
    close: true,
  };
  const noEvents = {
    label: `<span style='font-weight: bold'>${noEventsLabel}</span>`,
    onClick: () => updateEventFilter(NONE),
    close: true,
  };
  const eventOptions = [allEvents, noEvents, { divider: true }].concat(
    events.map((event) => ({
      onClick: () => updateEventFilter(event.eventId),
      label: event.eventName,
      close: true,
    })),
  );

  return { eventOptions, events };
}
