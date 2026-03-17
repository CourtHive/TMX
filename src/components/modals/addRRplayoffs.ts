/**
 * Add Round Robin playoff structures modal.
 * Configures playoff groups with finishing positions, draw type, and group size options.
 */
import { drawDefinitionConstants, tournamentEngine } from 'tods-competition-factory';
import { getDrawTypeOptions } from 'components/drawers/addDraw/getDrawTypeOptions';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { openModal } from 'components/modals/baseModal/baseModal';
import { renderForm } from 'courthive-components';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

import { DRAW_TYPE, GROUP_SIZE, NONE, PLAYOFF_NAME_BASE } from 'constants/tmxConstants';
import { ATTACH_PLAYOFF_STRUCTURES } from 'constants/mutationConstants';

const { ROUND_ROBIN, SINGLE_ELIMINATION } = drawDefinitionConstants;

export function addRRplayoffs({
  callback,
  drawId,
  structureId,
  playoffFinishingPositionRanges,
}: {
  callback?: () => void;
  drawId: string;
  structureId: string;
  playoffFinishingPositionRanges: any[];
}): void {
  const getId = (finishingPosition: number) => `finishingPosition-${finishingPosition}`;
  const fields = playoffFinishingPositionRanges.map(({ finishingPosition, finishingPositionRange }: any) => ({
    field: getId(finishingPosition),
    id: getId(finishingPosition),
    label: finishingPosition,
    checkbox: true,
    fieldPair: {
      text: `${t('modals.addRRplayoffs.createsPlayoff')} ${finishingPositionRange}`,
      width: '400px',
    },
  }));

  if (!fields || fields.length < 1) {
    tmxToast({ message: t('modals.addRRplayoffs.noPlayoffPositions'), intent: 'is-danger' });
    return;
  }

  const playoffStructureName = {
    value: PLAYOFF_NAME_BASE,
    label: t('modals.addRRplayoffs.playoffName'),
    field: 'structureName',
    id: 'structureName',
  };
  const drawTypeOptions = getDrawTypeOptions({ isPlayoff: true });
  const playoffDrawType = {
    value: SINGLE_ELIMINATION,
    options: drawTypeOptions,
    label: t('dtp'),
    field: DRAW_TYPE,
    id: DRAW_TYPE,
  };

  const { validGroupSizes } = tournamentEngine.getValidGroupSizes({ drawSize: 4, groupSizeLimit: 8 });
  const roundRobinOptions = validGroupSizes.map((size) => ({ label: size, value: size }));
  const groupSizeSelector = {
    options: roundRobinOptions,
    label: t('modals.addRRplayoffs.groupSize'),
    field: GROUP_SIZE,
    visible: false,
    value: 4,
  };

  const options = ([playoffStructureName, playoffDrawType, groupSizeSelector] as any[]).concat(fields);

  let inputs: any;

  const onClick = () => {
    const checkedRanges = playoffFinishingPositionRanges.filter(
      ({ finishingPosition }: any) => inputs[getId(finishingPosition)]?.checked,
    );
    const structureName = inputs.structureName.value;
    const drawType = inputs[DRAW_TYPE].value;
    const groupSize = drawType === ROUND_ROBIN ? Number.parseInt(inputs[GROUP_SIZE].value) : undefined;

    // Create a separate playoff group for each checked finishing position
    const playoffGroups = checkedRanges.map(({ finishingPosition, finishingPositionRange }: any) => ({
      finishingPositions: [finishingPosition],
      structureName: `${structureName} ${finishingPositionRange}`,
      drawType,
      ...(groupSize && { structureOptions: { groupSize } }),
    }));

    // Generate structures locally so client and server use identical structures
    const genResult = tournamentEngine.generateAndPopulatePlayoffStructures({
      playoffStructureNameBase: PLAYOFF_NAME_BASE,
      playoffGroups,
      structureId,
      drawId,
    });

    if (genResult.error) {
      tmxToast({ message: genResult.error?.message || 'Generation error', intent: 'is-danger' });
      return;
    }

    // Send generated structures to server via executionQueue
    const methods = [
      {
        method: ATTACH_PLAYOFF_STRUCTURES,
        params: {
          matchUpModifications: genResult.matchUpModifications,
          structures: genResult.structures,
          links: genResult.links,
          drawId,
        },
      },
    ];

    const postMutation = (result: any) => {
      if (result.success) {
        tmxToast({ message: t('modals.addRRplayoffs.structureAdded'), intent: 'is-success' });
        isFunction(callback) && callback?.();
      } else {
        console.log({ result });
        tmxToast({ message: result.error?.message || 'Error', intent: 'is-danger' });
      }
    };

    mutationRequest({ methods, callback: postMutation });
  };

  const checkFinishingPositions = () => {
    const checkStatus = playoffFinishingPositionRanges.map(
      ({ finishingPosition }: any) => inputs[getId(finishingPosition)].checked,
    );
    const checkCount = checkStatus.filter(Boolean).length;

    const addButton = document.getElementById('addStructure') as HTMLButtonElement;
    if (addButton) addButton.disabled = checkCount === 0;
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
    title: t('modals.addRRplayoffs.title'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: NONE, close: true },
      { label: t('add'), id: 'addStructure', intent: 'is-info', disabled: true, close: true, onClick },
    ],
  });
}
