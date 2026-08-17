/**
 * MatchUp competitiveness-profile filter for filterPopoverButton.
 * Filters completed matchUps by their competitiveness bucket
 * (COMPETITIVE / ROUTINE / DECISIVE) or by WALKOVER / defaulted status.
 *
 * Backs both the popover "Profile" section and click-to-filter on the
 * competitiveness bar; the token values match the bar's bucket keys.
 */
import { isWalkoverProfile } from './matchUpStatusPredicates';
import { context } from 'services/context';
import { t } from 'i18n';

export function getMatchUpProfileFilter(table: any): {
  profileOptions: any[];
  isFiltered: () => boolean;
  activeIndex: () => number;
  setProfile: (profile?: string) => void;
  getProfile: () => string | undefined;
} {
  let filterValue: string | undefined = context.matchUpFilters.profile;

  // Tabulator warns "Filter Error - No matching filter type found" when
  // removeFilter is handed a filter it never added — which is every first
  // call here, since the filter is only added when a value is set.
  let profileFilterApplied = false;

  const profileFilter = (rowData: any): boolean => {
    if (!filterValue) return true;
    if (filterValue === 'WALKOVER') return isWalkoverProfile(rowData);
    return rowData.competitiveProfile?.competitiveness === filterValue;
  };

  // Restore saved filter
  if (filterValue) {
    table.addFilter(profileFilter);
    profileFilterApplied = true;
  }

  const updateFilter = (profile?: string) => {
    if (profileFilterApplied) {
      table.removeFilter(profileFilter);
      profileFilterApplied = false;
    }
    filterValue = profile;
    context.matchUpFilters.profile = profile;
    if (profile) {
      table.addFilter(profileFilter);
      profileFilterApplied = true;
    }
  };

  const allLabel = t('pages.matchUps.allProfiles');
  const allOption = {
    label: `<span style='font-weight: bold'>${allLabel}</span>`,
    onClick: () => updateFilter(),
    close: true,
  };
  const profileOptions = [
    allOption,
    { divider: true },
    {
      label: t('pages.matchUps.competitive'),
      close: true,
      onClick: () => updateFilter('COMPETITIVE'),
      filterValue: 'COMPETITIVE',
    },
    { label: t('pages.matchUps.routine'), close: true, onClick: () => updateFilter('ROUTINE'), filterValue: 'ROUTINE' },
    {
      label: t('pages.matchUps.decisive'),
      close: true,
      onClick: () => updateFilter('DECISIVE'),
      filterValue: 'DECISIVE',
    },
    {
      label: t('pages.matchUps.walkover'),
      close: true,
      onClick: () => updateFilter('WALKOVER'),
      filterValue: 'WALKOVER',
    },
  ];

  const selectableOptions = profileOptions.filter((opt: any) => !opt.divider);
  const activeIndex = () => {
    if (!filterValue) return 0;
    const idx = selectableOptions.findIndex((opt: any) => opt.filterValue === filterValue);
    return idx >= 0 ? idx : 0;
  };

  return {
    profileOptions,
    isFiltered: () => !!filterValue,
    activeIndex,
    setProfile: updateFilter,
    getProfile: () => filterValue,
  };
}
