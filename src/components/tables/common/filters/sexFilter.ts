import { createChoiceFilter, type ChipFilter } from 'components/tables/common/filters/chipFilter';
import { genderConstants } from 'tods-competition-factory';
import { context } from 'services/context';
import { t } from 'i18n';

const { FEMALE, MALE, ANY } = genderConstants;

/**
 * The participants' sex filter: one chip filter that the filter popover shows as chips and the participants footer
 * toggles and counts, so the two never disagree.
 *
 * The selection persists in `participantFilters.sexes`. A selection saved before the filter took chips sits in the
 * single-valued `participantFilters.sex`, and is read once as the starting selection.
 */
export function getSexFilter(table: any): {
  chips?: any;
  options: any[];
  genders: Record<string, string>;
  isFiltered: () => boolean;
  activeIndex: () => number;
  filter: ChipFilter;
} {
  const filters = context.participantFilters;
  const initial = filters.sexes ?? (filters.sex ? [filters.sex] : undefined);
  delete filters.sex;

  const genders: Record<string, string> = {
    [MALE]: t('pages.participants.gender.male'),
    [FEMALE]: t('pages.participants.gender.female'),
    [ANY]: t('pages.participants.allGenders'),
  };

  const choice = createChoiceFilter({
    table,
    items: [MALE, FEMALE].map((sex) => ({ value: sex, label: genders[sex] })),
    allLabel: genders[ANY],
    matches: (rowData: any, sex: string) => rowData.participant?.person?.sex === sex,
    initial,
    persist: (selected) => (filters.sexes = selected),
  });

  return { ...choice, genders };
}
