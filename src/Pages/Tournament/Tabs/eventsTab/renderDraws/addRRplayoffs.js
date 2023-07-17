import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderForm } from 'components/renderers/renderForm';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

import { ADD_PLAYOFF_STRUCTURES } from 'constants/mutationConstants';
import { NONE, PLAYOFF_NAME_BASE } from 'constants/tmxConstants';

export function addRRplayoffs({ callback, drawId, structureId, playoffFinishingPositionRanges }) {
  const getId = (finishingPosition) => `finishingPosition-${finishingPosition}`;
  const fields = playoffFinishingPositionRanges.map(({ finishingPosition, finishingPositionRange }) => ({
    field: getId(finishingPosition),
    id: getId(finishingPosition),
    label: finishingPosition,
    checkbox: true,
    fieldPair: {
      text: `Creates playoff for positions ${finishingPositionRange}`,
      width: '400px'
    }
  }));

  if (!fields || fields.length < 1) {
    tmxToast({ message: 'No playoff positions available', intent: 'is-danger' });
    return;
  }

  const playoffStructureName = {
    value: PLAYOFF_NAME_BASE,
    label: 'Playoff Name',
    field: 'structureName',
    id: 'structureName'
  };
  const positionsToBePlayedOff = 'Positions to be played off:';
  const selectedPlayoffRange = {
    text: `${positionsToBePlayedOff} None`,
    id: 'selectedPlayoffRange'
  };
  const admonition = {
    text: 'Select group finishing positions. Selections must be sequential'
  };

  const options = [playoffStructureName, selectedPlayoffRange, admonition].concat(fields);

  let inputs;

  const onClick = () => {
    const structureName = inputs.structureName.value;
    const checkedRanges = playoffFinishingPositionRanges.filter(
      ({ finishingPosition }) => inputs[getId(finishingPosition)]?.checked
    );
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

  const getMinMax = (range) => `${Math.min(...range)}-${Math.max(...range)}`;

  const checkValid = () => {
    const finishingPositions = playoffFinishingPositionRanges
      .filter(({ finishingPosition }) => inputs[getId(finishingPosition)]?.checked)
      .map(({ finishingPositions }) => finishingPositions)
      .flat();
    const checkStatus = playoffFinishingPositionRanges.map(
      ({ finishingPosition }) => inputs[getId(finishingPosition)].checked
    );
    const checkCount = checkStatus.filter(Boolean).length;
    const nonSequential = checkStatus.reduce(
      (state, current) => {
        if (state.nonSequential) return state;
        if (current !== state.last) {
          state.last = current;
          if (current) state.checked += 1;
        }
        if (current && state.checked > 1) return { nonSequential: true };
        return state;
      },
      { nonSequential: undefined, checked: 0, last: undefined }
    ).nonSequential;

    const addButton = document.getElementById('addStructure');
    const valid = checkCount && !nonSequential;
    if (addButton) addButton.disabled = !valid;

    const selectedPlayoffRange = document.getElementById('selectedPlayoffRange');
    if (selectedPlayoffRange) {
      const range = valid ? getMinMax(finishingPositions) : 'None';
      selectedPlayoffRange.innerHTML = `${positionsToBePlayedOff} ${range}`;
    }
  };

  const relationships = playoffFinishingPositionRanges.map(({ finishingPosition }) => ({
    control: getId(finishingPosition),
    onChange: checkValid
  }));
  const content = (elem) => (inputs = renderForm(elem, options, relationships));

  context.modal.open({
    title: `Add playoff structure`,
    content,
    buttons: [
      { label: 'Cancel', intent: NONE, close: true },
      { label: 'Add', id: 'addStructure', intent: 'is-info', disabled: true, close: true, onClick }
    ]
  });
}
