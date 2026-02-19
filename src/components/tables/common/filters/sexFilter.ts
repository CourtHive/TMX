import { genderConstants } from 'tods-competition-factory';
import { t } from 'i18n';

const { FEMALE, MALE, ANY } = genderConstants;

export function getSexFilter(table: any): { sexOptions: any[]; genders: Record<string, string> } {
  let filterValue: string | undefined;

  const sexFilter = (rowData: any): boolean => rowData.participant?.person?.sex === filterValue;
  const updateSexFilter = (sex?: string) => {
    table.removeFilter(sexFilter);
    filterValue = sex;
    if (sex) table.addFilter(sexFilter);
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
      close: true,
    })),
  );

  return { sexOptions, genders };
}
