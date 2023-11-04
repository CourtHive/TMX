import { genderConstants } from 'tods-competition-factory';
import { renderParticipant } from 'courthive-components';
import { isFunction, isObject } from 'functions/typeOf';

const { MALE, FEMALE } = genderConstants;

export const formatParticipant = (onClick) => (cell, placeholder, layout) => {
  const def = cell.getColumn().getDefinition();
  const sideNumber = (def.field === 'side1' && 1) || (def.field === 'side2' && 2);
  const elem = document.createElement('div');
  const data = cell.getRow().getData();
  const hasWinner = data.winningSide;
  const value = cell.getValue();
  const participant = data.participant || value.participant || (data.person && data);
  if (participant) {
    const scaleAttributes = {
      accessor: 'utrRating',
      scaleType: 'RATING',
      scaleColor: 'blue',
      scaleName: 'UTR',
      fallback: true
    };

    const rendered = (participant) =>
      renderParticipant({
        eventHandlers: {
          participantClick: (params) => {
            return isFunction(onClick) && onClick({ ...params, event: params.pointerEvent, cell });
          }
        },
        composition: { configuration: { flag: false, genderColor: true, participantDetail: 'TEAM', scaleAttributes } },
        matchUp: data.matchUp,
        participant,
        placeholder,
        sideNumber
      });

    const renderPairParticipant = (participant) => {
      const div = document.createElement('div');
      div.className = 'flexrow flexjustifystart';
      participant.individualParticipants.forEach((individual, i) => {
        div.appendChild(rendered(individual));
        if (!i) {
          const spacer = document.createElement('span');
          spacer.style.width = '1em';
          spacer.innerHTML = '&nbsp;';
          div.appendChild(spacer);
        }
      });

      return div;
    };
    return layout === 'sideBySide' && participant.individualParticipants?.length === 2
      ? renderPairParticipant(participant)
      : rendered(participant);
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
