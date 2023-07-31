import { renderParticipant } from 'courthive-components/src/components/renderParticipant';
import { genderConstants } from 'tods-competition-factory';
import { isObject } from 'functions/typeOf';

const { MALE, FEMALE } = genderConstants;

export function formatParticipant(cell) {
  const def = cell.getColumn().getDefinition();
  const elem = document.createElement('div');
  const data = cell.getRow().getData();
  const hasWinner = data.winningSide;
  const value = cell.getValue();
  const participant = data.participant || value.participant || (data.person && data);
  if (participant) {
    return renderParticipant({
      composition: { configuration: { flags: true, genderColor: true, showAddress: true } },
      participant
    });
  }
  if (hasWinner) {
    const winningSide = def.field === data.winningSide;
    elem.style = winningSide ? 'color: green' : 'color: red';
  } else {
    const sex = value?.sex || data?.person?.sex;
    const color = (sex === MALE && '#2E86C1') || (sex === FEMALE && '#AA336A') || '';
    elem.style.color = color;
  }
  elem.innerHTML = (isObject(value) ? value.participantName : value) || '';
  return elem;
}
