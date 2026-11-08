/**
 * MatchUp status filter for filterPopoverButton, in two parts (CA 2026-11-08):
 *
 *   - status chips: To be played / Live / Suspended / Complete, a partition, any combination on. The same chips
 *     sit in the matchUps table's footer with counts (statusQuickStrip), one click from the table
 *   - the detail dropdown: what the chips do not say — ready to score, retired, irregular ending, abandoned,
 *     cancelled, and schedule locked. It ANDs with the chips
 *
 * Also honours the Today-view bar's partition tokens (prefixed `today:`) so a
 * single status filter backs both the popover and the bar. See
 * matchUpStatusPredicates for the shared classification.
 */
import { classifyTodayBucket, popoverStatusPredicate, TODAY_STATUS_PREFIX } from './matchUpStatusPredicates';
import { createChipFilter, type ChipFilter, type ChipSection } from './chipFilter';
import { STATUS_BUCKETS, statusBucketOf } from './matchUpStatusPredicates';
import { whenTableBuilt } from 'components/tables/common/whenTableBuilt';
import { context } from 'services/context';
import { t } from 'i18n';

const BUCKET_LABELS: Record<string, string> = {
  toBePlayed: 'pages.matchUps.toBePlayed',
  live: 'pages.matchUps.live',
  suspended: 'pages.matchUps.suspended',
  complete: 'pages.matchUps.complete',
};

export function getMatchUpStatusFilter(table: any): {
  statusOptions: any[];
  isFiltered: () => boolean;
  activeIndex: () => number;
  setStatus: (status?: string) => void;
  getStatus: () => string | undefined;
  statusChips: ChipSection;
  bucketFilter: ChipFilter;
  onBucketsChange: (listener: () => void) => void;
} {
  const listeners = new Set<() => void>();
  const bucketOptions = STATUS_BUCKETS.map((value) => ({ value, label: t(BUCKET_LABELS[value]) }));
  const bucketFilter = createChipFilter({
    table,
    values: [...STATUS_BUCKETS],
    matches: (rowData, value) => statusBucketOf(rowData) === value,
    initial: context.matchUpFilters.statusBuckets,
    persist: (selected) => (context.matchUpFilters.statusBuckets = selected),
    onChange: () => listeners.forEach((listener) => listener()),
  });

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

  // Restore saved filter once the table is built (Tabulator warns if called sooner).
  if (filterValue) {
    statusFilterApplied = true;
    whenTableBuilt(table, () => statusFilterApplied && table.addFilter(statusFilter));
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

  const allLabel = t('pages.matchUps.anyStatusDetail');
  const allOption = {
    label: `<span style='font-weight: bold'>${allLabel}</span>`,
    onClick: () => updateFilter(),
    close: true,
  };
  // the chips say to be played, suspended and complete; the dropdown says what they do not
  const detail = (key: string, value: string) => ({
    label: t(`pages.matchUps.${key}`),
    close: true,
    onClick: () => updateFilter(value),
    filterValue: value,
  });
  const statusOptions = [
    allOption,
    { divider: true },
    detail('readyToScore', 'readyToScore'),
    detail('retired', 'retired'),
    detail('irregularEnding', 'irregularEnding'),
    detail('abandoned', 'abandoned'),
    detail('cancelled', 'cancelled'),
    { divider: true },
    detail('scheduleLocked', 'scheduleLocked'),
  ];

  const selectableOptions = statusOptions.filter((opt: any) => !opt.divider);
  const activeIndex = () => {
    if (!filterValue) return 0;
    const idx = selectableOptions.findIndex((opt: any) => opt.filterValue === filterValue);
    // `findIndex` yields -1 or a valid index, so clamping at 0 is exactly
    // the old ternary. SonarJS prefers Math.max here.
    return Math.max(idx, 0);
  };

  return {
    statusOptions,
    isFiltered: () => !!filterValue,
    activeIndex,
    setStatus: updateFilter,
    getStatus: () => filterValue,
    statusChips: {
      options: bucketOptions,
      isOn: bucketFilter.isOn,
      toggle: bucketFilter.toggle,
      clear: bucketFilter.clear,
    },
    bucketFilter,
    onBucketsChange: (listener: () => void) => listeners.add(listener),
  };
}
