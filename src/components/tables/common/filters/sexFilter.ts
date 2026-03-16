import { genderConstants } from 'tods-competition-factory';
import { t } from 'i18n';

const { FEMALE, MALE, ANY } = genderConstants;

export function getSexFilter(
  table: any,
  onChange?: () => void,
): { sexOptions: any[]; genders: Record<string, string>; isFiltered: () => boolean; activeIndex: () => number } {
  let filterValue: string | undefined;

  const sexFilter = (rowData: any): boolean => rowData.participant?.person?.sex === filterValue;
  const updateSexFilter = (sex?: string) => {
    table.removeFilter(sexFilter);
    filterValue = sex;
    if (sex) table.addFilter(sexFilter);
    if (onChange) onChange();
  };
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
    return idx >= 0 ? idx : 0;
  };

  return { sexOptions, genders, isFiltered, activeIndex };
}
