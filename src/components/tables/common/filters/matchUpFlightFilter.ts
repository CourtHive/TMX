/**
 * MatchUp flight filter for filterPopoverButton.
 * Filters matchUps by flight (draw).
 */
import { tournamentEngine } from 'tods-competition-factory';
import { t } from 'i18n';

export function getMatchUpFlightFilter(table: any): {
  flightOptions: any[];
  hasOptions: boolean;
  isFiltered: () => boolean;
  activeIndex: () => number;
} {
  let filterValue: string | undefined;

  const flightFilter = (rowData: any): boolean => rowData.drawId === filterValue;
  const updateFilter = (drawId?: string) => {
    table.removeFilter(flightFilter);
    filterValue = drawId;
    if (drawId) table.addFilter(flightFilter);
  };

  const events = tournamentEngine.getEvents().events || [];
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
    return idx >= 0 ? idx : 0;
  };

  return { flightOptions, hasOptions: flightOptions.length > 3, isFiltered: () => !!filterValue, activeIndex };
}
