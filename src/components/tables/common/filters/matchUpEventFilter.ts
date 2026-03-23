/**
 * MatchUp event filter for filterPopoverButton.
 * Filters matchUps by event (using eventId on row data).
 */
import { tournamentEngine } from 'tods-competition-factory';
import { context } from 'services/context';
import { t } from 'i18n';

export function getMatchUpEventFilter(table: any): {
  eventOptions: any[];
  hasOptions: boolean;
  isFiltered: () => boolean;
  activeIndex: () => number;
} {
  let filterValue: string | undefined = context.matchUpFilters.eventId;

  const eventFilter = (rowData: any): boolean => rowData.eventId === filterValue;
  const updateFilter = (eventId?: string) => {
    table.removeFilter(eventFilter);
    filterValue = eventId;
    context.matchUpFilters.eventId = eventId;
    if (eventId) table.addFilter(eventFilter);
  };

  // Restore saved filter
  if (filterValue) table.addFilter(eventFilter);

  const events = tournamentEngine.getEvents().events || [];
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
    return idx >= 0 ? idx : 0;
  };

  return { eventOptions, hasOptions: events.length > 1, isFiltered: () => !!filterValue, activeIndex };
}
