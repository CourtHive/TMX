/**
 * MatchUp competitiveness-profile filter for filterPopoverButton: chips for COMPETITIVE / ROUTINE / DECISIVE and
 * WALKOVER / defaulted, any combination on (CA 2026-11-08). Every chip on is "all profiles".
 *
 * Also backs click-to-filter on the competitiveness bar, whose segments are one bucket each: `setProfile` selects
 * exactly that bucket, and `getProfile` names the bucket only when exactly one is selected, so the bar lights a
 * segment for a single profile and none for a combination. The token values match the bar's bucket keys.
 */
import { createChipFilter, type ChipSection } from './chipFilter';
import { isWalkoverProfile } from './matchUpStatusPredicates';
import { PROFILE_COLORS } from './statusColors';
import { context } from 'services/context';
import { t } from 'i18n';

const PROFILES: [string, string][] = [
  ['COMPETITIVE', 'pages.matchUps.competitive'],
  ['ROUTINE', 'pages.matchUps.routine'],
  ['DECISIVE', 'pages.matchUps.decisive'],
  ['WALKOVER', 'pages.matchUps.walkover'],
];

export function profileMatches(rowData: any, value: string): boolean {
  if (value === 'WALKOVER') return isWalkoverProfile(rowData);
  return rowData.competitiveProfile?.competitiveness === value;
}

export function getMatchUpProfileFilter(table: any): {
  chips: ChipSection;
  isFiltered: () => boolean;
  setProfile: (profile?: string) => void;
  getProfile: () => string | undefined;
} {
  const options = PROFILES.map(([value, key]) => ({ value, label: t(key), ...PROFILE_COLORS[value] }));
  const filter = createChipFilter({
    table,
    values: options.map(({ value }) => value),
    matches: profileMatches,
    initial: context.matchUpFilters.profile,
    persist: (selected) => (context.matchUpFilters.profile = selected),
  });

  return {
    chips: { options, isOn: filter.isOn, toggle: filter.toggle, clear: filter.clear },
    isFiltered: filter.isFiltered,
    setProfile: (profile?: string) => filter.set(profile ? [profile] : undefined),
    getProfile: () => {
      const selected = filter.selected();
      return selected?.length === 1 ? selected[0] : undefined;
    },
  };
}
