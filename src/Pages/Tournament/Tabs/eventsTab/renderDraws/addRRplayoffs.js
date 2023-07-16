import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderForm } from 'components/renderers/renderForm';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

import { NONE, PLAYOFF_NAME_BASE } from 'constants/tmxConstants';
import { ADD_PLAYOFF_STRUCTURES } from 'constants/mutationConstants';

export function addRRplayoffs({ callback, drawId, structureId, playoffFinishingPositionRanges }) {
  const fields = playoffFinishingPositionRanges.map(({ finishingPosition, finishingPositionRange }) => ({
    field: `finishingPosition-${finishingPosition}`,
    id: `finishingPosition-${finishingPosition}`,
    label: finishingPosition,
    checkbox: true,
    fieldPair: {
      text: `Creates playoff for positions ${finishingPositionRange}`,
      width: '400px'
    }
  }));

  if (!fields || fields.length < 2) {
    tmxToast({ message: 'No playoff positions available', intent: 'is-danger' });
    return;
  }

  const playoffStructureName = {
    value: PLAYOFF_NAME_BASE,
    label: 'Playoff Name',
    field: 'structureName',
    id: 'structureName'
  };
  const admonition = {
    text: 'Select group finishing positions. Selections must be sequential'
  };

  const options = [playoffStructureName, admonition].concat(fields);

  let inputs;

  const onClick = () => {
    const structureName = inputs.structureName.value;
    const checkedRanges = playoffFinishingPositionRanges.filter(({ finishingPosition }) => {
      const id = `finishingPosition-${finishingPosition}`;
      return inputs[id]?.checked;
    });
    const finishingPositions = checkedRanges.map(({ finishingPosition }) => finishingPosition);
    const playoffGroups = [
      {
        drawType: 'SINGLE_ELIMINATION',
        finishingPositions,
        structureName
      }
    ];

    const methods = [
      {
        params: { drawId, structureId, playoffGroups, playoffStructureNameBase: PLAYOFF_NAME_BASE },
        method: ADD_PLAYOFF_STRUCTURES
      }
    ];

    const postMutation = (result) => {
      if (result.success) {
        tmxToast({ message: 'Structure added', intent: 'is-success' });
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
    title: `Add playoff structure`,
    content,
    buttons: [
      { label: 'Cancel', intent: NONE, close: true },
      { label: 'Add', intent: 'is-info', close: true, onClick }
    ]
  });
}
