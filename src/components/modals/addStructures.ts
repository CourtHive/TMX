/**
 * Add playoff structures modal with round selection.
 * Configures playoff rounds for finishing position ranges with custom naming.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { openModal } from 'components/modals/baseModal/baseModal';
import { renderForm } from 'courthive-components';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { addRRplayoffs } from './addRRplayoffs';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

import { ADD_PLAYOFF_STRUCTURES } from 'constants/mutationConstants';
import { NONE, PLAYOFF_NAME_BASE } from 'constants/tmxConstants';

export function addStructures({
  drawId,
  structureId,
  callback,
}: {
  drawId: string;
  structureId: string;
  callback?: () => void;
}): void {
  const result = tournamentEngine.getAvailablePlayoffProfiles({ drawId, structureId });
  const sum = (p: any) => p.finishingPositions.reduce((a: number, b: number) => (a || 0) + (b || 0));

  if (!result.playoffRoundsRanges && result.finishingPositionsAvailable?.length) {
    return (addRRplayoffs as any)({ ...result, drawId, structureId, callback });
  }

  const fields = result.playoffRoundsRanges
    ?.sort((a: any, b: any) => sum(a) - sum(b))
    .map(({ finishingPositionRange }: any) => ({
      label: finishingPositionRange,
      field: finishingPositionRange,
      id: finishingPositionRange,
      checkbox: true,
      fieldPair: {
        field: `${finishingPositionRange}-name`,
        placeholder: `${PLAYOFF_NAME_BASE} ${finishingPositionRange}`,
        id: `${finishingPositionRange}-name`,
        width: '350px',
      },
    }));

  if (!fields || fields.length < 1) {
    tmxToast({ message: t('modals.addStructures.noPlayoffPositions'), intent: 'is-danger' });
    return;
  }

  const modifyPlaceholders = (value: string) => {
    fields.forEach(({ label, fieldPair }: any) => {
      const elem = document.getElementById(fieldPair.id);
      if (elem) (elem as HTMLInputElement).placeholder = `${value} ${label}`;
    });
  };

  const nameBase = {
    onChange: (e: Event) => modifyPlaceholders((e.target as HTMLInputElement).value),
    onKeyDown: (e: KeyboardEvent) => e.key === 'Tab' && modifyPlaceholders((e.target as HTMLInputElement).value),
    value: PLAYOFF_NAME_BASE,
    label: t('modals.addStructures.nameBase'),
    field: 'nameBase',
    id: 'nameBase',
  };

  const options = [nameBase].concat(fields);

  let inputs: any;

  const onClick = () => {
    const checkedRanges = result.playoffRoundsRanges.filter(
      (range: any) => inputs[range.finishingPositionRange]?.checked,
    );

    const playoffStructureNameBase = inputs.nameBase.value;
    const playoffAttributes: any = {};
    const roundProfiles = checkedRanges.map(({ roundNumber, finishingPositionRange }: any) => {
      const name = inputs[`${finishingPositionRange}-name`]?.value;
      if (name) {
        playoffAttributes[`0-${roundNumber}`] = { name };
      }
      return { [roundNumber]: 1 };
    });
    const methods = [
      {
        params: { drawId, structureId, playoffAttributes, roundProfiles, playoffStructureNameBase },
        method: ADD_PLAYOFF_STRUCTURES,
      },
    ];
    const postMutation = (result: any) => {
      if (result.success) {
        tmxToast({ message: t('modals.addStructures.structuresAdded'), intent: 'is-success' });
        isFunction(callback) && callback?.();
      } else {
        tmxToast({ message: result.error?.message || 'Error', intent: 'is-danger' });
      }
    };
    mutationRequest({ methods, callback: postMutation });
  };

  const checkValid = () => {
    const checkedRanges = result.playoffRoundsRanges.filter(
      (range: any) => inputs[range.finishingPositionRange]?.checked,
    );
    const addButton = document.getElementById('addStructure');
    if (addButton) (addButton as HTMLButtonElement).disabled = !checkedRanges.length;
  };
  const relationships = result.playoffRoundsRanges.map(({ finishingPositionRange }: any) => ({
    control: finishingPositionRange,
    onChange: checkValid,
  }));
  const content = (elem: HTMLElement) => (inputs = renderForm(elem, options, relationships));

  openModal({
    title: t('modals.addStructures.title'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: NONE, close: true },
      { label: t('add'), id: 'addStructure', disabled: true, intent: 'is-info', close: true, onClick },
    ],
  });
}
