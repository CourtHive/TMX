/**
 * MatchUp scheduled-date filter for filterPopoverButton.
 * Filters matchUps to a specific tournament date, today, or matchUps with no scheduled date.
 *
 * Filter values stored on `context.matchUpFilters.scheduledDate`:
 *   - undefined  — show all dates (no filter applied)
 *   - 'today'    — resolves to today's ISO date at filter time
 *   - 'YYYY-MM-DD' — a specific date string
 *   - '__none__' — matchUps with no scheduledDate
 */
import { whenTableBuilt } from 'components/tables/common/whenTableBuilt';
import { venueCalendarDate } from 'functions/venueTimeFrame';
import { competitionEngine } from 'services/factory/engine';
import { context } from 'services/context';
import { t } from 'i18n';

export const TODAY_TOKEN = 'today';
const NO_DATE_TOKEN = '__none__';

/**
 * Today at the **venue** (`YYYY-MM-DD`) — the day the "Today" filter token means.
 *
 * Not the operator's: the Today bar and the schedule's Now strip have to name the
 * same day, and the schedule keys on the venue. See `functions/venueTimeFrame`.
 */
export function isoToday(): string {
  return venueCalendarDate();
}

function formatDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function dateRange(start?: string, end?: string): string[] {
  if (!start || !end) return [];
  const dates: string[] = [];
  const current = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export function getMatchUpDateFilter(table: any): {
  dateOptions: any[];
  hasOptions: boolean;
  isFiltered: () => boolean;
  activeIndex: () => number;
  setDate: (value?: string) => void;
  getDate: () => string | undefined;
} {
  let filterValue: string | undefined = context.matchUpFilters.scheduledDate;

  // Tabulator warns "Filter Error - No matching filter type found" when
  // removeFilter is handed a filter it never added — which is every first
  // call here, since the filter is only added when a value is set.
  let dateFilterApplied = false;

  const dateFilter = (rowData: any): boolean => {
    if (!filterValue) return true;
    if (filterValue === NO_DATE_TOKEN) return !rowData.scheduledDate;
    const target = filterValue === TODAY_TOKEN ? isoToday() : filterValue;
    return rowData.scheduledDate === target;
  };

  const updateFilter = (value?: string) => {
    if (dateFilterApplied) {
      table.removeFilter(dateFilter);
      dateFilterApplied = false;
    }
    filterValue = value;
    context.matchUpFilters.scheduledDate = value;
    if (value) {
      table.addFilter(dateFilter);
      dateFilterApplied = true;
    }
  };

  // Restore saved filter once the table is built (Tabulator warns if called sooner).
  if (filterValue) {
    dateFilterApplied = true;
    whenTableBuilt(table, () => dateFilterApplied && table.addFilter(dateFilter));
  }

  // Resolve active dates: prefer tournamentInfo.activeDates, fall back to date range.
  const { tournamentInfo } = competitionEngine.getTournamentInfo() ?? {};
  const { startDate, endDate } = competitionEngine.getCompetitionDateRange() ?? {};
  const activeDates: string[] = tournamentInfo?.activeDates?.length
    ? tournamentInfo.activeDates
    : dateRange(startDate, endDate);
  const sortedDates = [...activeDates].sort((a, b) => a.localeCompare(b));

  const allLabel = t('pages.matchUps.allDates');
  const allOption = {
    label: `<span style='font-weight: bold'>${allLabel}</span>`,
    onClick: () => updateFilter(),
    close: true,
  };

  const todayOption = {
    label: t('pages.matchUps.today'),
    filterValue: TODAY_TOKEN,
    onClick: () => updateFilter(TODAY_TOKEN),
    close: true,
  };

  const dateOptionsList = sortedDates.map((iso) => ({
    label: formatDateLabel(iso),
    filterValue: iso,
    onClick: () => updateFilter(iso),
    close: true,
  }));

  const noDateOption = {
    label: t('pages.matchUps.noDate'),
    filterValue: NO_DATE_TOKEN,
    onClick: () => updateFilter(NO_DATE_TOKEN),
    close: true,
  };

  const dateOptions = [
    allOption,
    { divider: true },
    todayOption,
    ...(dateOptionsList.length ? [{ divider: true }, ...dateOptionsList] : []),
    { divider: true },
    noDateOption,
  ];

  const selectableOptions = dateOptions.filter((opt: any) => !opt.divider);
  const activeIndex = () => {
    if (!filterValue) return 0;
    const idx = selectableOptions.findIndex((opt: any) => opt.filterValue === filterValue);
    // `findIndex` yields -1 or a valid index, so clamping at 0 is exactly
    // the old ternary. SonarJS prefers Math.max here.
    return Math.max(idx, 0);
  };

  return {
    dateOptions,
    hasOptions: true,
    isFiltered: () => !!filterValue,
    activeIndex,
    setDate: updateFilter,
    getDate: () => filterValue,
  };
}
