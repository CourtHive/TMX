/**
 * Edit group names modal for round robin structures.
 * Allows renaming of group structures with minimum character validation.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { openModal } from 'components/modals/baseModal/baseModal';
import { validators, renderForm } from 'courthive-components';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';

import { RENAME_STRUCTURES } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';

export function editGroupNames({
  drawId,
  structure,
  callback,
}: {
  drawId: string;
  structure: any;
  callback?: (result: any) => void;
}): void {
  const matchUps = Object.values(structure.roundMatchUps).flat();
  const groups = matchUps.reduce((groups: Record<string, any>, matchUp: any) => {
    const { structureName, structureId } = matchUp;
    if (!groups[structureId]) groups[structureId] = { structureName, structureId };
    return groups;
  }, {});
  const options = Object.values(groups).map(({ structureName, structureId }: any) => ({
    text: `${structureName}:`,
    fieldPair: {
      error: 'minimum 4 characters',
      validator: validators.nameValidator(4),
      placeholder: structureName,
      field: structureId,
      id: structureId,
    },
  }));

  let inputs: any;
  const onClick = () => {
    const structureDetails = Object.values(groups)
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
        tmxToast({ message: 'Groups renamed', intent: 'is-success' });
        isFunction(callback) && callback?.(result);
      }
    };
    mutationRequest({ methods, callback: postMutation });
  };
  const checkValid = () => {
    const nameValues = Object.values(groups)
      .map(({ structureId }: any) => inputs[structureId]?.value)
      .filter(Boolean);
    const validValues = nameValues.every(validators.nameValidator(4));
    const renameButton = document.getElementById('renameGroups');
    const valid = nameValues.length && validValues;
    if (renameButton) (renameButton as HTMLButtonElement).disabled = !valid;
  };
  const relationships = Object.values(groups).map(({ structureId }: any) => ({
    control: structureId,
    onInput: checkValid,
  }));
  const content = (elem: HTMLElement) => (inputs = renderForm(elem, options, relationships));
  openModal({
    title: `Edit group names`,
    content,
    buttons: [
      { label: 'Cancel', intent: NONE, close: true },
      { label: 'Rename', id: 'renameGroups', disabled: true, intent: 'is-info', close: true, onClick },
    ],
  });
}
