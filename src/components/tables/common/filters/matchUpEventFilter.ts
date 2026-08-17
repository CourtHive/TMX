/**
 * MatchUp event filter for filterPopoverButton.
 * Filters matchUps by event (using eventId on row data).
 */
import { tournamentEngine } from 'services/factory/engine';
import { context } from 'services/context';
import { t } from 'i18n';

export function getMatchUpEventFilter(
  table: any,
  preFetchedEvents?: any[],
): {
  eventOptions: any[];
  hasOptions: boolean;
  isFiltered: () => boolean;
  activeIndex: () => number;
} {
  let filterValue: string | undefined = context.matchUpFilters.eventId;

  // Tabulator warns "Filter Error - No matching filter type found" when
  // removeFilter is handed a filter it never added — which is every first
  // call here, since the filter is only added when a value is set.
  let eventFilterApplied = false;

  const eventFilter = (rowData: any): boolean => rowData.eventId === filterValue;
  const updateFilter = (eventId?: string) => {
    if (eventFilterApplied) {
      table.removeFilter(eventFilter);
      eventFilterApplied = false;
    }
    filterValue = eventId;
    context.matchUpFilters.eventId = eventId;
    if (eventId) {
      table.addFilter(eventFilter);
      eventFilterApplied = true;
    }
  };

  // Restore saved filter
  if (filterValue) {
    table.addFilter(eventFilter);
    eventFilterApplied = true;
  }

  // Caller can hand in a pre-fetched events list to share one q.events()
  // call across the event/flight/team filters on the matchUps tab.
  const events = preFetchedEvents ?? tournamentEngine.q.events() ?? [];
  const allLabel = t('pages.matchUps.allEvents');
  const allOption = {
    label: `<span style='font-weight: bold'>${allLabel}</span>`,
    onClick: () => updateFilter(),
    close: true,
  };
  const eventOptions = [allOption, { divider: true }].concat(
    events.map((event: any) => ({
      onClick: () => updateFilter(event.eventId),
      label: event.eventName,
      filterValue: event.eventId,
      close: true,
    })),
  );

  const selectableOptions = eventOptions.filter((opt: any) => !opt.divider);
  const activeIndex = () => {
    if (!filterValue) return 0;
    const idx = selectableOptions.findIndex((opt: any) => opt.filterValue === filterValue);
    // `findIndex` yields -1 or a valid index, so clamping at 0 is exactly
    // the old ternary. SonarJS prefers Math.max here.
    return Math.max(idx, 0);
  };

  return { eventOptions, hasOptions: events.length > 1, isFiltered: () => !!filterValue, activeIndex };
}
