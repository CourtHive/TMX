import { genderConstants } from 'tods-competition-factory';

const { MALE, FEMALE } = genderConstants;

export function genderedText(cell) {
  const value = cell.getValue();
  const data = cell.getRow().getData();
  const sex = data.sex || data.person?.sex;
  const color = (sex?.toUpperCase() === MALE && '#2E86C1') || (sex?.toUpperCase() === FEMALE && '#AA336A') || '';
  const el = document.createElement('div');
  el.style.color = color;
  el.innerHTML = value;
  return el;
}
