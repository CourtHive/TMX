import { genderConstants } from 'tods-competition-factory';
import { isObject } from 'functions/typeOf';

const { MALE, FEMALE } = genderConstants;

export function highlightWinningSide(cell) {
  const def = cell.getColumn().getDefinition();
  const elem = document.createElement('div');
  const data = cell.getRow().getData();
  const hasWinner = data.winningSide;
  const value = cell.getValue();
  if (hasWinner) {
    const winningSide = def.field === data.winningSide;
    elem.style = winningSide ? 'color: green' : 'color: red';
  } else {
    const color = (isObject(value) && value?.sex === MALE && '#2E86C1') || (value?.sex === FEMALE && '#AA336A') || '';
    elem.style.color = color;
  }
  elem.innerHTML = (isObject(value) ? value.participantName : value) || '';
  return elem;
}
