import { genderConstants } from 'tods-competition-factory';

const { FEMALE, MALE, MIXED } = genderConstants;

export function getSexFilter(table) {
  let filterValue;

  const sexFilter = (rowData) => rowData.participant?.person?.sex === filterValue;
  const updateSexFilter = (sex) => {
    if (filterValue) table.removeFilter(sexFilter);
    filterValue = sex;
    if (sex) table.addFilter(sexFilter);
  };
  const sexes = [MALE, FEMALE];
  const genders = { [MALE]: 'Male', [FEMALE]: 'Female', [MIXED]: 'All genders' };
  const allSexes = { label: genders[MIXED], onClick: updateSexFilter, close: true };
  const sexOptions = [allSexes].concat(
    sexes.map((sex) => ({
      onClick: () => updateSexFilter(sex),
      label: genders[sex],
      close: true
    }))
  );

  return { sexOptions, genders };
}
