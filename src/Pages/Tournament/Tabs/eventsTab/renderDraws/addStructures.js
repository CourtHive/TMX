import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderForm } from 'components/renderers/renderForm';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

import { ADD_PLAYOFF_STRUCTURES } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';

const playoffNameBase = 'Playoff';

export function addStructures({ drawId, structureId, callback }) {
  const result = tournamentEngine.getAvailablePlayoffProfiles({ drawId, structureId });
  const sum = (p) => p.finishingPositions.reduce((a, b) => (a || 0) + (b || 0));

  const fields = result.playoffRoundsRanges
    .sort((a, b) => sum(a) - sum(b))
    .map(({ finishingPositionRange }) => ({
      label: finishingPositionRange,
      field: finishingPositionRange,
      id: finishingPositionRange,
      checkbox: true,
      fieldPair: {
        field: `${finishingPositionRange}-name`,
        placeholder: `${playoffNameBase} ${finishingPositionRange}`,
        id: `${finishingPositionRange}-name`,
        width: '350px'
      }
    }));

  const modifyPlaceholders = (value) => {
    fields.forEach(({ label, fieldPair }) => {
      const elem = document.getElementById(fieldPair.id);
      if (elem) elem.placeholder = `${value} ${label}`;
    });
  };

  const nameBase = {
    onChange: (e) => modifyPlaceholders(e.target.value),
    onKeyDown: (e) => e.key === 'Tab' && modifyPlaceholders(e.target.value),
    value: playoffNameBase,
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
        isFunction(callback) && callback();
      } else {
        tmxToast({ message: result.error, intent: 'is-danger' });
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
