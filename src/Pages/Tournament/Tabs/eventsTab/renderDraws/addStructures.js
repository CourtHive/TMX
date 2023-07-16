import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderForm } from 'components/renderers/renderForm';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { addRRplayoffs } from './addRRplayoffs';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

import { ADD_PLAYOFF_STRUCTURES } from 'constants/mutationConstants';
import { NONE, PLAYOFF_NAME_BASE } from 'constants/tmxConstants';

export function addStructures({ drawId, structureId, callback }) {
  const result = tournamentEngine.getAvailablePlayoffProfiles({ drawId, structureId });
  const sum = (p) => p.finishingPositions.reduce((a, b) => (a || 0) + (b || 0));

  if (!result.playoffRoundsRanges && result.finishingPositionsAvailable?.length) {
    return addRRplayoffs({ ...result, drawId, structureId, callback });
  }

  const fields = result.playoffRoundsRanges
    ?.sort((a, b) => sum(a) - sum(b))
    .map(({ finishingPositionRange }) => ({
      label: finishingPositionRange,
      field: finishingPositionRange,
      id: finishingPositionRange,
      checkbox: true,
      fieldPair: {
        field: `${finishingPositionRange}-name`,
        placeholder: `${PLAYOFF_NAME_BASE} ${finishingPositionRange}`,
        id: `${finishingPositionRange}-name`,
        width: '350px'
      }
    }));

  if (!fields || fields.length < 2) {
    tmxToast({ message: 'No playoff positions available', intent: 'is-danger' });
    return;
  }

  const modifyPlaceholders = (value) => {
    fields.forEach(({ label, fieldPair }) => {
      const elem = document.getElementById(fieldPair.id);
      if (elem) elem.placeholder = `${value} ${label}`;
    });
  };

  const nameBase = {
    onChange: (e) => modifyPlaceholders(e.target.value),
    onKeyDown: (e) => e.key === 'Tab' && modifyPlaceholders(e.target.value),
    value: PLAYOFF_NAME_BASE,
    label: 'Name base',
    field: 'nameBase',
    id: 'nameBase'
  };

  const options = [nameBase].concat(fields);

  let inputs;

  const onClick = () => {
    const checkedRanges = result.playoffRoundsRanges.filter((range) => inputs[range.finishingPositionRange]?.checked);

    const playoffStructureNameBase = inputs.nameBase.value;
    const playoffAttributes = {};
    const roundProfiles = checkedRanges.map(({ roundNumber, finishingPositionRange }) => {
      const name = inputs[`${finishingPositionRange}-name`]?.value;
      if (name) {
        playoffAttributes[`0-${roundNumber}`] = { name };
      }
      return { [roundNumber]: 1 };
    });
    const methods = [
      {
        params: { drawId, structureId, playoffAttributes, roundProfiles, playoffStructureNameBase },
        method: ADD_PLAYOFF_STRUCTURES
      }
    ];
    const postMutation = (result) => {
      if (result.success) {
        tmxToast({ message: 'Structure(s) added', intent: 'is-success' });
        isFunction(callback) && callback();
      } else {
        tmxToast({ message: result.error?.message || 'Error', intent: 'is-danger' });
      }
    };
    mutationRequest({ methods, callback: postMutation });
  };
  const content = (elem) => (inputs = renderForm(elem, options));

  context.modal.open({
    title: `Add playoff structures`,
    content,
    buttons: [
      { label: 'Cancel', intent: NONE, close: true },
      { label: 'Add', intent: 'is-info', close: true, onClick }
    ]
  });
}
