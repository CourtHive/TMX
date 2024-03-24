import { genderConstants } from 'tods-competition-factory';

import { ALL_GENDERS } from 'constants/tmxConstants';

const { FEMALE, MALE, ANY } = genderConstants;

export function getSexFilter(table) {
  let filterValue;

  const sexFilter = (rowData) => rowData.participant?.person?.sex === filterValue;
  const updateSexFilter = (sex) => {
    table.removeFilter(sexFilter);
    filterValue = sex;
    if (sex) table.addFilter(sexFilter);
  };
  const sexes = [MALE, FEMALE];
  const genders = { [MALE]: 'Male', [FEMALE]: 'Female', [ANY]: ALL_GENDERS };
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
