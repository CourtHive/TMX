import { genderConstants } from 'tods-competition-factory';
import { renderParticipant } from 'courthive-components';
import { isFunction, isObject } from 'functions/typeOf';

const { MALE, FEMALE } = genderConstants;

export const formatParticipant = (onClick) => (cell, placeholder) => {
  const def = cell.getColumn().getDefinition();
  const sideNumber = (def.field === 'side1' && 1) || (def.field === 'side2' && 2);
  const elem = document.createElement('div');
  const data = cell.getRow().getData();
  const hasWinner = data.winningSide;
  const value = cell.getValue();
  const participant = data.participant || value.participant || (data.person && data);
  if (participant) {
    return renderParticipant({
      eventHandlers: { participantClick: (params) => isFunction(onClick) && onClick({ ...params, cell }) },
      composition: { configuration: { flags: true, genderColor: true, participantDetail: 'TEAM' } },
      matchUp: data.matchUp,
      participant,
      placeholder,
      sideNumber
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
};
