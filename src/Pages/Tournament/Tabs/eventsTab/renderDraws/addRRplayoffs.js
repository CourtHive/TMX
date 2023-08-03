import { getDrawTypeOptions } from 'components/drawers/addDraw/getDrawTypeOptions';
import { drawDefinitionConstants, drawEngine } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { openModal } from 'components/modals/baseModal/baseModal';
import { renderOptions } from 'components/renderers/renderField';
import { removeAllChildNodes } from 'services/dom/transformers';
import { renderForm } from 'components/renderers/renderForm';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';

import { DRAW_TYPE, GROUP_SIZE, NONE, PLAYOFF_NAME_BASE } from 'constants/tmxConstants';
import { ADD_PLAYOFF_STRUCTURES } from 'constants/mutationConstants';

const { ROUND_ROBIN, SINGLE_ELIMINATION } = drawDefinitionConstants;

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
    label: 'Playoff name',
    field: 'structureName',
    id: 'structureName'
  };
  const drawTypeOptions = getDrawTypeOptions({ isPlayoff: true });
  const playoffDrawType = {
    value: SINGLE_ELIMINATION,
    options: drawTypeOptions,
    label: 'Draw type',
    field: DRAW_TYPE,
    id: DRAW_TYPE
  };

  const { validGroupSizes } = drawEngine.getValidGroupSizes({ drawSize: 4, groupSizeLimit: 8 });
  const roundRobinOptions = validGroupSizes.map((size) => ({ label: size, value: size }));
  const groupSizeSelector = {
    options: roundRobinOptions,
    label: 'Group size',
    field: GROUP_SIZE,
    visible: false,
    value: 4
  };

  const positionsToBePlayedOff = 'Positions to be played off:';
  const selectedPlayoffRange = {
    text: `${positionsToBePlayedOff} None`,
    id: 'selectedPlayoffRange'
  };
  const admonition = {
    text: 'Select group finishing positions. Selections must be sequential'
  };

  const options = [playoffStructureName, playoffDrawType, groupSizeSelector, selectedPlayoffRange, admonition].concat(
    fields
  );

  let inputs;

  const onClick = () => {
    const checkedRanges = playoffFinishingPositionRanges.filter(
      ({ finishingPosition }) => inputs[getId(finishingPosition)]?.checked
    );
    const finishingPositions = checkedRanges.map(({ finishingPosition }) => finishingPosition);
    const structureName = inputs.structureName.value;
    const drawType = inputs[DRAW_TYPE].value;
    const playoffGroup = {
      finishingPositions,
      structureName,
      drawType
    };

    if (drawType === ROUND_ROBIN) {
      const groupSize = parseInt(inputs[GROUP_SIZE].value);
      playoffGroup.structureOptions = { groupSize };
    }

    const methods = [
      {
        params: { drawId, structureId, playoffGroups: [playoffGroup], playoffStructureNameBase: PLAYOFF_NAME_BASE },
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

  const checkFinishingPositions = () => {
    const finishingPositions = playoffFinishingPositionRanges
      .filter(({ finishingPosition }) => inputs[getId(finishingPosition)]?.checked)
      .map(({ finishingPositions }) => finishingPositions)
      .flat();
    const checkStatus = playoffFinishingPositionRanges.map(
      ({ finishingPosition }) => inputs[getId(finishingPosition)].checked
    );
    const selectedFinishingPositions = playoffFinishingPositionRanges
      .map(({ finishingPosition }) => inputs[getId(finishingPosition)].checked && finishingPosition)
      .filter(Boolean);
    const sequential = selectedFinishingPositions
      .map((pos, i) => (selectedFinishingPositions[i + 1] || pos) - pos)
      .every((val) => val < 2);
    const checkCount = checkStatus.filter(Boolean).length;

    const addButton = document.getElementById('addStructure');
    const valid = checkCount && sequential;
    if (addButton) addButton.disabled = !valid;

    const selectedPlayoffRange = document.getElementById('selectedPlayoffRange');
    if (selectedPlayoffRange) {
      const range = valid ? getMinMax(finishingPositions) : 'None';
      selectedPlayoffRange.innerHTML = `${positionsToBePlayedOff} ${range}`;
    }

    const { validGroupSizes } = drawEngine.getValidGroupSizes({
      drawSize: finishingPositions?.length || 4,
      groupSizeLimit: 8
    });
    const options = validGroupSizes.map((size) => ({ label: size, value: size }));
    const groupSizeSelect = inputs[GROUP_SIZE];
    const value = validGroupSizes.includes(4) ? 4 : validGroupSizes[0];
    removeAllChildNodes(groupSizeSelect);
    renderOptions(groupSizeSelect, { options, value });
  };

  const drawTypeChange = ({ e, fields }) => {
    const drawType = e.target.value;

    const groupSizeVisible = [ROUND_ROBIN].includes(drawType);
    fields[GROUP_SIZE].style.display = groupSizeVisible ? '' : NONE;
  };

  const relationships = playoffFinishingPositionRanges
    .map(({ finishingPosition }) => ({
      control: getId(finishingPosition),
      onChange: checkFinishingPositions
    }))
    .concat([
      {
        onChange: drawTypeChange,
        control: DRAW_TYPE
      }
    ]);
  const content = (elem) => (inputs = renderForm(elem, options, relationships));

  openModal({
    title: `Add playoff structure`,
    content,
    buttons: [
      { label: 'Cancel', intent: NONE, close: true },
      { label: 'Add', id: 'addStructure', intent: 'is-info', disabled: true, close: true, onClick }
    ]
  });
}
