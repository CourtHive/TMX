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
import { competitionEngine } from 'tods-competition-factory';
import { context } from 'services/context';
import { t } from 'i18n';

const TODAY_TOKEN = 'today';
const NO_DATE_TOKEN = '__none__';

function isoToday(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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
} {
  let filterValue: string | undefined = context.matchUpFilters.scheduledDate;

  const dateFilter = (rowData: any): boolean => {
    if (!filterValue) return true;
    if (filterValue === NO_DATE_TOKEN) return !rowData.scheduledDate;
    const target = filterValue === TODAY_TOKEN ? isoToday() : filterValue;
    return rowData.scheduledDate === target;
  };

  const updateFilter = (value?: string) => {
    table.removeFilter(dateFilter);
    filterValue = value;
    context.matchUpFilters.scheduledDate = value;
    if (value) table.addFilter(dateFilter);
  };

  // Restore saved filter
  if (filterValue) table.addFilter(dateFilter);

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
    return idx >= 0 ? idx : 0;
  };

  return {
    dateOptions,
    hasOptions: true,
    isFiltered: () => !!filterValue,
    activeIndex,
  };
}
