/**
 * Add Round Robin playoff structures modal.
 * Configures playoff groups with finishing positions, draw type, and group size options.
 */
import { drawDefinitionConstants, tournamentEngine } from 'tods-competition-factory';
import { getDrawTypeOptions } from 'components/drawers/addDraw/getDrawTypeOptions';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { openModal } from 'components/modals/baseModal/baseModal';
import { renderOptions } from 'courthive-components';
import { removeAllChildNodes } from 'services/dom/transformers';
import { renderForm } from 'courthive-components';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';

import { DRAW_TYPE, GROUP_SIZE, NONE, PLAYOFF_NAME_BASE } from 'constants/tmxConstants';
import { ADD_PLAYOFF_STRUCTURES } from 'constants/mutationConstants';

const { ROUND_ROBIN, SINGLE_ELIMINATION } = drawDefinitionConstants;

export function addRRplayoffs({ callback, drawId, structureId, playoffFinishingPositionRanges }: { callback?: () => void; drawId: string; structureId: string; playoffFinishingPositionRanges: any[] }): void {
  const getId = (finishingPosition: number) => `finishingPosition-${finishingPosition}`;
  const fields = playoffFinishingPositionRanges.map(({ finishingPosition, finishingPositionRange }: any) => ({
    field: getId(finishingPosition),
    id: getId(finishingPosition),
    label: finishingPosition,
    checkbox: true,
    fieldPair: {
      text: `Creates playoff for positions ${finishingPositionRange}`,
      width: '400px',
    },
  }));

  if (!fields || fields.length < 1) {
    tmxToast({ message: 'No playoff positions available', intent: 'is-danger' });
    return;
  }

  const playoffStructureName = {
    value: PLAYOFF_NAME_BASE,
    label: 'Playoff name',
    field: 'structureName',
    id: 'structureName',
  };
  const drawTypeOptions = getDrawTypeOptions({ isPlayoff: true });
  const playoffDrawType = {
    value: SINGLE_ELIMINATION,
    options: drawTypeOptions,
    label: 'Draw type',
    field: DRAW_TYPE,
    id: DRAW_TYPE,
  };

  const { validGroupSizes } = tournamentEngine.getValidGroupSizes({ drawSize: 4, groupSizeLimit: 8 });
  const roundRobinOptions = validGroupSizes.map((size) => ({ label: size, value: size }));
  const groupSizeSelector = {
    options: roundRobinOptions,
    label: 'Group size',
    field: GROUP_SIZE,
    visible: false,
    value: 4,
  };

  const positionsToBePlayedOff = 'Positions to be played off:';
  const selectedPlayoffRange = {
    text: `${positionsToBePlayedOff} None`,
    id: 'selectedPlayoffRange',
  };
  const admonition = {
    text: 'Select group finishing positions. Selections must be sequential',
  };

  const options = ([playoffStructureName, playoffDrawType, groupSizeSelector, selectedPlayoffRange, admonition] as any[]).concat(
    fields,
  );

  let inputs: any;

  const onClick = () => {
    const checkedRanges = playoffFinishingPositionRanges.filter(
      ({ finishingPosition }: any) => inputs[getId(finishingPosition)]?.checked,
    );
    const finishingPositions = checkedRanges.map(({ finishingPosition }: any) => finishingPosition);
    const structureName = inputs.structureName.value;
    const drawType = inputs[DRAW_TYPE].value;
    const playoffGroup: any = {
      finishingPositions,
      structureName,
      drawType,
    };

    if (drawType === ROUND_ROBIN) {
      const groupSize = parseInt(inputs[GROUP_SIZE].value);
      playoffGroup.structureOptions = { groupSize };
    }

    const methods = [
      {
        params: { drawId, structureId, playoffGroups: [playoffGroup], playoffStructureNameBase: PLAYOFF_NAME_BASE },
        method: ADD_PLAYOFF_STRUCTURES,
      },
    ];

    const postMutation = (result: any) => {
      if (result.success) {
        tmxToast({ message: 'Structure added', intent: 'is-success' });
        isFunction(callback) && callback && callback();
      } else {
        console.log({ result });
        tmxToast({ message: result.error?.message || 'Error', intent: 'is-danger' });
      }
    };

    mutationRequest({ methods, callback: postMutation });
  };

  const getMinMax = (range: number[]) => `${Math.min(...range)}-${Math.max(...range)}`;

  const checkFinishingPositions = () => {
    const finishingPositions = playoffFinishingPositionRanges
      .filter(({ finishingPosition }: any) => inputs[getId(finishingPosition)]?.checked)
      .map(({ finishingPositions }: any) => finishingPositions)
      .flat();
    const checkStatus = playoffFinishingPositionRanges.map(
      ({ finishingPosition }: any) => inputs[getId(finishingPosition)].checked,
    );
    const selectedFinishingPositions = playoffFinishingPositionRanges
      .map(({ finishingPosition }: any) => inputs[getId(finishingPosition)].checked && finishingPosition)
      .filter(Boolean);
    const sequential = selectedFinishingPositions
      .map((pos: number, i: number) => (selectedFinishingPositions[i + 1] || pos) - pos)
      .every((val: number) => val < 2);
    const checkCount = checkStatus.filter(Boolean).length;

    const addButton = document.getElementById('addStructure') as HTMLButtonElement;
    const valid = checkCount && sequential;
    if (addButton) addButton.disabled = !valid;

    const selectedPlayoffRange = document.getElementById('selectedPlayoffRange');
    if (selectedPlayoffRange) {
      const range = valid ? getMinMax(finishingPositions) : 'None';
      selectedPlayoffRange.innerHTML = `${positionsToBePlayedOff} ${range}`;
    }

    const { validGroupSizes } = tournamentEngine.getValidGroupSizes({
      drawSize: finishingPositions?.length || 4,
      groupSizeLimit: 8,
    });
    const options = validGroupSizes.map((size) => ({ label: size, value: size }));
    const groupSizeSelect = inputs[GROUP_SIZE];
    const value = validGroupSizes.includes(4) ? 4 : validGroupSizes[0];
    removeAllChildNodes(groupSizeSelect);
    renderOptions(groupSizeSelect, { options, value });
  };

  const drawTypeChange = ({ e, fields }: any) => {
    const drawType = e.target.value;

    const groupSizeVisible = [ROUND_ROBIN].includes(drawType);
    fields[GROUP_SIZE].style.display = groupSizeVisible ? '' : NONE;
  };

  const relationships = playoffFinishingPositionRanges
    .map(({ finishingPosition }: any) => ({
      control: getId(finishingPosition),
      onChange: checkFinishingPositions,
    }))
    .concat([
      {
        onChange: drawTypeChange as any,
        control: DRAW_TYPE,
      },
    ] as any);
  const content = (elem: HTMLElement) => (inputs = renderForm(elem, options, relationships));

  openModal({
    title: `Add playoff structure`,
    content,
    buttons: [
      { label: 'Cancel', intent: NONE, close: true },
      { label: 'Add', id: 'addStructure', intent: 'is-info', disabled: true, close: true, onClick },
    ],
  });
}
