/**
 * MatchUp type filter for filterPopoverButton.
 * Filters matchUps by type: singles, doubles, or team.
 */
import { eventConstants } from 'tods-competition-factory';
import { context } from 'services/context';
import { t } from 'i18n';

const { TEAM_EVENT, SINGLES, DOUBLES } = eventConstants;

export function getMatchUpTypeFilter(
  table: any,
  data: any[],
): { typeOptions: any[]; hasOptions: boolean; isFiltered: () => boolean; activeIndex: () => number } {
  let filterValue: string | undefined = context.matchUpFilters.type;

  const typeFilter = (rowData: any): boolean => rowData.matchUpType === filterValue;

  // Restore saved filter
  if (filterValue) table.addFilter(typeFilter);

  const updateFilter = (type?: string) => {
    table.removeFilter(typeFilter);
    filterValue = type;
    context.matchUpFilters.type = type;
    if (type) table.addFilter(typeFilter);
  };

  const matchUpTypes = data.reduce((types: string[], matchUp: any) => {
    if (!types.includes(matchUp.matchUpType)) types.push(matchUp.matchUpType);
    return types;
  }, []);

  const allLabel = t('pages.matchUps.allTypes');
  const allOption = {
    label: `<span style='font-weight: bold'>${allLabel}</span>`,
    onClick: () => updateFilter(),
    close: true,
  };
  const typeOptions = [
    allOption,
    { divider: true },
    matchUpTypes.includes(SINGLES) && {
      label: t('pages.matchUps.singles'),
      close: true,
      onClick: () => updateFilter(SINGLES),
      filterValue: SINGLES,
    },
    matchUpTypes.includes(DOUBLES) && {
      label: t('pages.matchUps.doubles'),
      close: true,
      onClick: () => updateFilter(DOUBLES),
      filterValue: DOUBLES,
    },
    matchUpTypes.includes(TEAM_EVENT) && {
      label: t('pages.matchUps.team'),
      close: true,
      onClick: () => updateFilter(TEAM_EVENT),
      filterValue: TEAM_EVENT,
    },
  ].filter(Boolean);

  const selectableOptions = typeOptions.filter((opt: any) => !opt.divider);
  const activeIndex = () => {
    if (!filterValue) return 0;
    const idx = selectableOptions.findIndex((opt: any) => opt.filterValue === filterValue);
    return idx >= 0 ? idx : 0;
  };

  return { typeOptions, hasOptions: matchUpTypes.length > 1, isFiltered: () => !!filterValue, activeIndex };
}
