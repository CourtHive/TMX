/**
 * Edit structure names modal with validation.
 * Allows renaming of draw structures with minimum character validation.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { openModal } from 'components/modals/baseModal/baseModal';
import { validators, renderForm } from 'courthive-components';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';

import { RENAME_STRUCTURES } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';

export function editStructureNames({ drawId, callback }: { drawId: string; callback?: () => void }): void {
  const structures = tournamentEngine.getEvent({ drawId })?.drawDefinition?.structures;
  if (!structures?.length) return;

  const options = structures.map(({ structureName, structureId }: any, index: number) => ({
    text: `${structureName}:`,
    fieldPair: {
      error: 'minimum 4 characters',
      validator: validators.nameValidator(4),
      placeholder: structureName,
      focus: index === 0,
      field: structureId,
      id: structureId,
    },
  }));

  let inputs: any;
  const onClick = () => {
    const structureDetails = structures
      .map(
        ({ structureId }: any) =>
          inputs[structureId]?.value && { structureId, structureName: inputs[structureId].value.trim() },
      )
      .filter(Boolean);
    const methods = [
      {
        params: { drawId, structureDetails },
        method: RENAME_STRUCTURES,
      },
    ];
    const postMutation = (result: any) => {
      if (result.success) {
        tmxToast({ message: 'Structure renamed', intent: 'is-success' });
        isFunction(callback) && callback?.();
      }
    };
    mutationRequest({ methods, callback: postMutation });
  };
  const checkValid = () => {
    const nameValues = structures.map(({ structureId }: any) => inputs[structureId]?.value).filter(Boolean);
    const validValues = nameValues.every(validators.nameValidator(4));
    const renameButton = document.getElementById('renameStructures');
    const valid = nameValues.length && validValues;
    if (renameButton) (renameButton as HTMLButtonElement).disabled = !valid;
  };
  const relationships = structures.map(({ structureId }: any) => ({
    control: structureId,
    onInput: checkValid,
  }));
  const content = (elem: HTMLElement) => (inputs = renderForm(elem, options, relationships));
  openModal({
    title: `Edit structure names`,
    content,
    buttons: [
      { label: 'Cancel', intent: NONE, close: true },
      { label: 'Rename', id: 'renameStructures', disabled: true, intent: 'is-info', close: true, onClick },
    ],
  });
}
