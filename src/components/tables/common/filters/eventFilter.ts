import { tournamentEngine } from 'services/factory/engine';
import type { Event } from 'tods-competition-factory';
import { context } from 'services/context';
import { t } from 'i18n';

import { NONE } from 'constants/tmxConstants';

export function getEventFilter(
  table: any,
  onChange?: () => void,
): {
  events: Event[];
  eventOptions: any[];
  isFiltered: () => boolean;
  activeIndex: () => number;
} {
  let filterValue: string | undefined = context.participantFilters.eventId;

  // Tabulator warns "Filter Error - No matching filter type found" when
  // removeFilter is handed a filter it never added — which is every first
  // call here, since the filter is only added when a value is set.
  let eventFilterApplied = false;

  const eventFilter = (rowData) =>
    filterValue === NONE ? !rowData?.eventIds?.length : rowData?.eventIds?.includes(filterValue);
  const updateEventFilter = (eventId?) => {
    if (eventFilterApplied) {
      table.removeFilter(eventFilter);
      eventFilterApplied = false;
    }
    filterValue = eventId;
    context.participantFilters.eventId = eventId;
    if (eventId) {
      table.addFilter(eventFilter);
      eventFilterApplied = true;
    }
    if (onChange) onChange();
  };

  // Restore saved filter
  if (filterValue) {
    table.addFilter(eventFilter);
    eventFilterApplied = true;
  }
  const events = tournamentEngine.q.events() || [];
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
  const eventOptions = [allEvents, { ...noEvents, filterValue: '__NONE__' }, { divider: true }].concat(
    events.map((event) => ({
      onClick: () => updateEventFilter(event.eventId),
      label: event.eventName ?? '',
      filterValue: event.eventId,
      close: true,
    })),
  );

  const isFiltered = () => !!filterValue;

  const selectableOptions = eventOptions.filter((opt: any) => !opt.divider);
  const activeIndex = () => {
    if (!filterValue) return 0;
    const matchValue = filterValue === NONE ? '__NONE__' : filterValue;
    const idx = selectableOptions.findIndex((opt: any) => opt.filterValue === matchValue);
    // `findIndex` yields -1 or a valid index, so clamping at 0 is exactly
    // the old ternary. SonarJS prefers Math.max here.
    return Math.max(idx, 0);
  };

  return { eventOptions, events, isFiltered, activeIndex };
}
