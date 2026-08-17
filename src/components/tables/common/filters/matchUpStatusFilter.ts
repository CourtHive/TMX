/**
 * MatchUp status filter for filterPopoverButton.
 * Filters matchUps by status: to be played (incl. suspended), suspended,
 * ready to score, complete, retired, or irregular ending.
 *
 * Also honours the Today-view bar's partition tokens (prefixed `today:`) so a
 * single status filter backs both the popover and the bar. See
 * matchUpStatusPredicates for the shared classification.
 */
import { classifyTodayBucket, popoverStatusPredicate, TODAY_STATUS_PREFIX } from './matchUpStatusPredicates';
import { context } from 'services/context';
import { t } from 'i18n';

export function getMatchUpStatusFilter(table: any): {
  statusOptions: any[];
  isFiltered: () => boolean;
  activeIndex: () => number;
  setStatus: (status?: string) => void;
  getStatus: () => string | undefined;
} {
  let filterValue: string | undefined = context.matchUpFilters.status;

  // Tabulator warns "Filter Error - No matching filter type found" when
  // removeFilter is handed a filter it never added — which is every first
  // call here, since the filter is only added when a value is set.
  let statusFilterApplied = false;

  const statusFilter = (rowData: any): boolean => {
    if (!filterValue) return true;
    if (filterValue.startsWith(TODAY_STATUS_PREFIX)) {
      return classifyTodayBucket(rowData) === filterValue.slice(TODAY_STATUS_PREFIX.length);
    }
    return popoverStatusPredicate(rowData, filterValue);
  };

  // Restore saved filter
  if (filterValue) {
    table.addFilter(statusFilter);
    statusFilterApplied = true;
  }

  const updateFilter = (status?: string) => {
    if (statusFilterApplied) {
      table.removeFilter(statusFilter);
      statusFilterApplied = false;
    }
    filterValue = status;
    context.matchUpFilters.status = status;
    if (status) {
      table.addFilter(statusFilter);
      statusFilterApplied = true;
    }
  };

  const allLabel = t('pages.matchUps.allStatuses');
  const allOption = {
    label: `<span style='font-weight: bold'>${allLabel}</span>`,
    onClick: () => updateFilter(),
    close: true,
  };
  const statusOptions = [
    allOption,
    { divider: true },
    {
      label: t('pages.matchUps.toBePlayed'),
      close: true,
      onClick: () => updateFilter('toBePlayed'),
      filterValue: 'toBePlayed',
    },
    {
      label: t('pages.matchUps.suspended'),
      close: true,
      onClick: () => updateFilter('suspended'),
      filterValue: 'suspended',
    },
    {
      label: t('pages.matchUps.readyToScore'),
      close: true,
      onClick: () => updateFilter('readyToScore'),
      filterValue: 'readyToScore',
    },
    {
      label: t('pages.matchUps.complete'),
      close: true,
      onClick: () => updateFilter('complete'),
      filterValue: 'complete',
    },
    { label: t('pages.matchUps.retired'), close: true, onClick: () => updateFilter('retired'), filterValue: 'retired' },
    {
      label: t('pages.matchUps.irregularEnding'),
      close: true,
      onClick: () => updateFilter('irregularEnding'),
      filterValue: 'irregularEnding',
    },
    {
      label: t('pages.matchUps.abandoned'),
      close: true,
      onClick: () => updateFilter('abandoned'),
      filterValue: 'abandoned',
    },
    {
      label: t('pages.matchUps.cancelled'),
      close: true,
      onClick: () => updateFilter('cancelled'),
      filterValue: 'cancelled',
    },
    { divider: true },
    {
      label: t('pages.matchUps.scheduleLocked'),
      close: true,
      onClick: () => updateFilter('scheduleLocked'),
      filterValue: 'scheduleLocked',
    },
  ];

  const selectableOptions = statusOptions.filter((opt: any) => !opt.divider);
  const activeIndex = () => {
    if (!filterValue) return 0;
    const idx = selectableOptions.findIndex((opt: any) => opt.filterValue === filterValue);
    return idx >= 0 ? idx : 0;
  };

  return {
    statusOptions,
    isFiltered: () => !!filterValue,
    activeIndex,
    setStatus: updateFilter,
    getStatus: () => filterValue,
  };
}
