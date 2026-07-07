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

  const statusFilter = (rowData: any): boolean => {
    if (!filterValue) return true;
    if (filterValue.startsWith(TODAY_STATUS_PREFIX)) {
      return classifyTodayBucket(rowData) === filterValue.slice(TODAY_STATUS_PREFIX.length);
    }
    return popoverStatusPredicate(rowData, filterValue);
  };

  // Restore saved filter
  if (filterValue) table.addFilter(statusFilter);

  const updateFilter = (status?: string) => {
    table.removeFilter(statusFilter);
    filterValue = status;
    context.matchUpFilters.status = status;
    if (status) table.addFilter(statusFilter);
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
    { label: t('pages.matchUps.toBePlayed'), close: true, onClick: () => updateFilter('toBePlayed'), filterValue: 'toBePlayed' },
    { label: t('pages.matchUps.suspended'), close: true, onClick: () => updateFilter('suspended'), filterValue: 'suspended' },
    { label: t('pages.matchUps.readyToScore'), close: true, onClick: () => updateFilter('readyToScore'), filterValue: 'readyToScore' },
    { label: t('pages.matchUps.complete'), close: true, onClick: () => updateFilter('complete'), filterValue: 'complete' },
    { label: t('pages.matchUps.retired'), close: true, onClick: () => updateFilter('retired'), filterValue: 'retired' },
    { label: t('pages.matchUps.irregularEnding'), close: true, onClick: () => updateFilter('irregularEnding'), filterValue: 'irregularEnding' },
    { label: t('pages.matchUps.abandoned'), close: true, onClick: () => updateFilter('abandoned'), filterValue: 'abandoned' },
    { label: t('pages.matchUps.cancelled'), close: true, onClick: () => updateFilter('cancelled'), filterValue: 'cancelled' },
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
