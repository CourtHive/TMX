import { whenTableBuilt } from 'components/tables/common/whenTableBuilt';
import { genderConstants } from 'tods-competition-factory';
import { context } from 'services/context';
import { t } from 'i18n';

const { FEMALE, MALE, ANY } = genderConstants;

export function getSexFilter(
  table: any,
  onChange?: () => void,
): { sexOptions: any[]; genders: Record<string, string>; isFiltered: () => boolean; activeIndex: () => number } {
  let filterValue: string | undefined = context.participantFilters.sex;

  // See the sibling filters: removeFilter on a never-added filter makes
  // Tabulator warn "Filter Error - No matching filter type found".
  let sexFilterApplied = false;

  const sexFilter = (rowData: any): boolean => rowData.participant?.person?.sex === filterValue;
  const updateSexFilter = (sex?: string) => {
    if (sexFilterApplied) {
      table.removeFilter(sexFilter);
      sexFilterApplied = false;
    }
    filterValue = sex;
    context.participantFilters.sex = sex;
    if (sex) {
      table.addFilter(sexFilter);
      sexFilterApplied = true;
    }
    if (onChange) onChange();
  };

  // Restore saved filter once the table is built (Tabulator warns if called sooner).
  if (filterValue) {
    sexFilterApplied = true;
    whenTableBuilt(table, () => sexFilterApplied && table.addFilter(sexFilter));
  }
  const sexes = [MALE, FEMALE];
  const genders: Record<string, string> = {
    [MALE]: t('pages.participants.gender.male'),
    [FEMALE]: t('pages.participants.gender.female'),
    [ANY]: t('pages.participants.allGenders'),
  };
  const allSexes = {
    label: `<span style='font-weight: bold'>${genders[ANY]}</span>`,
    onClick: () => updateSexFilter(),
    close: true,
  };
  const sexOptions = [allSexes, { divider: true }].concat(
    sexes.map((sex) => ({
      onClick: () => updateSexFilter(sex),
      label: genders[sex],
      filterValue: sex,
      close: true,
    })),
  );

  const isFiltered = () => !!filterValue;

  const selectableOptions = sexOptions.filter((opt: any) => !opt.divider);
  const activeIndex = () => {
    if (!filterValue) return 0;
    const idx = selectableOptions.findIndex((opt: any) => opt.filterValue === filterValue);
    // `findIndex` yields -1 or a valid index, so clamping at 0 is exactly
    // the old ternary. SonarJS prefers Math.max here.
    return Math.max(idx, 0);
  };

  return { sexOptions, genders, isFiltered, activeIndex };
}
