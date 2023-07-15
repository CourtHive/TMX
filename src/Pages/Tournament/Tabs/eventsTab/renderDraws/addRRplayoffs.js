import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderForm } from 'components/renderers/renderForm';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

import { NONE, PLAYOFF_NAME_BASE } from 'constants/tmxConstants';
import { ADD_PLAYOFF_STRUCTURES } from 'constants/mutationConstants';

export function addRRplayoffs({ callback, drawId, structureId, playoffFinishingPositionRanges }) {
  const fields = playoffFinishingPositionRanges.map(({ finishingPositionRange }) => ({
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

  const nameBase = {
    onChange: (e) => modifyPlaceholders(e.target.value),
    onKeyDown: (e) => e.key === 'Tab' && modifyPlaceholders(e.target.value),
    value: PLAYOFF_NAME_BASE,
    label: 'Name base',
    field: 'nameBase',
    id: 'nameBase'
  };

  const modifyPlaceholders = (value) => {
    fields.forEach(({ label, fieldPair }) => {
      const elem = document.getElementById(fieldPair.id);
      if (elem) elem.placeholder = `${value} ${label}`;
    });
  };

  const options = [nameBase].concat(fields);

  let inputs;

  const onClick = () => {
    const playoffStructureNameBase = inputs.nameBase.value;
    const checkedRanges = playoffFinishingPositionRanges.filter(
      (range) => inputs[range.finishingPositionRange]?.checked
    );
    const playoffGroups = checkedRanges.map(({ finishingPosition, finishingPositionRange }) => {
      const input = inputs[`${finishingPositionRange}-name`];
      const structureName = input?.value || input?.placeholder || PLAYOFF_NAME_BASE;
      return {
        finishingPositions: [finishingPosition],
        drawType: 'SINGLE_ELIMINATION',
        structureName
      };
    });

    const methods = [
      {
        params: { drawId, structureId, playoffGroups, playoffStructureNameBase },
        method: ADD_PLAYOFF_STRUCTURES
      }
    ];

    const postMutation = (result) => {
      if (result.success) {
        tmxToast({ message: 'Structures added', intent: 'is-success' });
        isFunction(callback) && callback();
      } else {
        console.log({ result });
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
