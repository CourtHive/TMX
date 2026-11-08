/**
 * MatchUp type filter for filterPopoverButton: a chip for each type the tournament has (singles, doubles, team),
 * any combination on (CA 2026-11-08). Every chip on is "all types".
 */
import { createChipFilter, type ChipSection } from './chipFilter';
import { eventConstants } from 'tods-competition-factory';
import { context } from 'services/context';
import { t } from 'i18n';

const { TEAM_EVENT, SINGLES, DOUBLES } = eventConstants;

const TYPE_LABELS: [string, string][] = [
  [SINGLES, 'pages.matchUps.singles'],
  [DOUBLES, 'pages.matchUps.doubles'],
  [TEAM_EVENT, 'pages.matchUps.team'],
];

export function getMatchUpTypeFilter(
  table: any,
  data: any[],
): { chips: ChipSection; hasOptions: boolean; isFiltered: () => boolean } {
  const present = new Set(data.map((matchUp: any) => matchUp.matchUpType));
  const options = TYPE_LABELS.filter(([value]) => present.has(value)).map(([value, key]) => ({ value, label: t(key) }));

  const filter = createChipFilter({
    table,
    values: options.map(({ value }) => value),
    matches: (rowData, value) => rowData.matchUpType === value,
    initial: context.matchUpFilters.type,
    persist: (selected) => (context.matchUpFilters.type = selected),
  });

  return {
    chips: { options, isOn: filter.isOn, toggle: filter.toggle, clear: filter.clear },
    hasOptions: options.length > 1,
    isFiltered: filter.isFiltered,
  };
}
