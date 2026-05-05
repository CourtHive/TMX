/**
 * MatchUp status filter for filterPopoverButton.
 * Filters matchUps by status: to be played, ready to score, complete, retired, or irregular ending.
 */
import { context } from 'services/context';
import { t } from 'i18n';

export function getMatchUpStatusFilter(table: any): { statusOptions: any[]; isFiltered: () => boolean; activeIndex: () => number } {
  let filterValue: string | undefined = context.matchUpFilters.status;

  const statusFilter = (rowData: any): boolean => {
    const matchUpStatus = rowData.scoreDetail.matchUpStatus;
    if (filterValue === 'toBePlayed') {
      return matchUpStatus === 'TO_BE_PLAYED';
    } else if (filterValue === 'readyToScore') {
      return (
        rowData.scoreDetail.readyToScore &&
        !rowData.scoreDetail.score &&
        !rowData.scoreDetail.winningSide &&
        !['DOUBLE_WALKOVER', 'DOUBLE_DEFAULT', 'CANCELLED', 'ABANDONED'].includes(matchUpStatus)
      );
    } else if (filterValue === 'complete') {
      return (
        rowData.scoreDetail.winningSide ||
        ['DOUBLE_WALKOVER', 'DOUBLE_DEFAULT', 'CANCELLED', 'ABANDONED'].includes(matchUpStatus)
      );
    } else if (filterValue === 'retired') {
      return matchUpStatus === 'RETIRED';
    } else if (filterValue === 'irregularEnding') {
      return ['DEFAULTED', 'WALKOVER'].includes(matchUpStatus);
    }
    return true;
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
    { label: t('pages.matchUps.readyToScore'), close: true, onClick: () => updateFilter('readyToScore'), filterValue: 'readyToScore' },
    { label: t('pages.matchUps.complete'), close: true, onClick: () => updateFilter('complete'), filterValue: 'complete' },
    { label: t('pages.matchUps.retired'), close: true, onClick: () => updateFilter('retired'), filterValue: 'retired' },
    { label: t('pages.matchUps.irregularEnding'), close: true, onClick: () => updateFilter('irregularEnding'), filterValue: 'irregularEnding' },
  ];

  const selectableOptions = statusOptions.filter((opt: any) => !opt.divider);
  const activeIndex = () => {
    if (!filterValue) return 0;
    const idx = selectableOptions.findIndex((opt: any) => opt.filterValue === filterValue);
    return idx >= 0 ? idx : 0;
  };

  return { statusOptions, isFiltered: () => !!filterValue, activeIndex };
}
