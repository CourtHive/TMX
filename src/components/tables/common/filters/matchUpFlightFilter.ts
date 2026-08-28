/**
 * MatchUp flight filter for filterPopoverButton.
 * Filters matchUps by flight (draw).
 */
import { whenTableBuilt } from 'components/tables/common/whenTableBuilt';
import { tournamentEngine } from 'services/factory/engine';
import { context } from 'services/context';
import { t } from 'i18n';

export function getMatchUpFlightFilter(
  table: any,
  preFetchedEvents?: any[],
): {
  flightOptions: any[];
  hasOptions: boolean;
  isFiltered: () => boolean;
  activeIndex: () => number;
} {
  let filterValue: string | undefined = context.matchUpFilters.drawId;

  // Tabulator warns "Filter Error - No matching filter type found" when
  // removeFilter is handed a filter it never added — which is every first
  // call here, since the filter is only added when a value is set.
  let flightFilterApplied = false;

  const flightFilter = (rowData: any): boolean => rowData.drawId === filterValue;
  const updateFilter = (drawId?: string) => {
    if (flightFilterApplied) {
      table.removeFilter(flightFilter);
      flightFilterApplied = false;
    }
    filterValue = drawId;
    context.matchUpFilters.drawId = drawId;
    if (drawId) {
      table.addFilter(flightFilter);
      flightFilterApplied = true;
    }
  };

  // Restore saved filter once the table is built (Tabulator warns if called sooner).
  if (filterValue) {
    flightFilterApplied = true;
    whenTableBuilt(table, () => flightFilterApplied && table.addFilter(flightFilter));
  }

  // Caller can hand in a pre-fetched events list to share one q.events()
  // call across the event/flight/team filters on the matchUps tab.
  const events = preFetchedEvents ?? tournamentEngine.q.events() ?? [];
  const allLabel = t('pages.matchUps.allFlights');
  const allOption = {
    label: `<span style='font-weight: bold'>${allLabel}</span>`,
    onClick: () => updateFilter(),
    close: true,
  };
  const flightOptions = [allOption, { divider: true }].concat(
    events
      .flatMap(
        (event: any) =>
          event.drawDefinitions?.map(({ drawId, drawName }: any) => ({
            onClick: () => updateFilter(drawId),
            label: drawName,
            filterValue: drawId,
            close: true,
          })) || [],
      )
      .filter(Boolean),
  );

  const selectableOptions = flightOptions.filter((opt: any) => !opt.divider);
  const activeIndex = () => {
    if (!filterValue) return 0;
    const idx = selectableOptions.findIndex((opt: any) => opt.filterValue === filterValue);
    // `findIndex` yields -1 or a valid index, so clamping at 0 is exactly
    // the old ternary. SonarJS prefers Math.max here.
    return Math.max(idx, 0);
  };

  return { flightOptions, hasOptions: flightOptions.length > 3, isFiltered: () => !!filterValue, activeIndex };
}
