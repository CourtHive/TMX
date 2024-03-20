import { mutationRequest } from 'services/mutation/mutationRequest';
import { nameValidator } from 'components/validators/nameValidator';
import { openModal } from 'components/modals/baseModal/baseModal';
import { renderForm } from 'components/renderers/renderForm';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';

import { RENAME_STRUCTURES } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';

export function editGroupNames({ drawId, structure, callback }) {
  const matchUps = Object.values(structure.roundMatchUps).flat();
  const groups = matchUps.reduce((groups, matchUp) => {
    const { structureName, structureId } = matchUp;
    if (!groups[structureId]) groups[structureId] = { structureName, structureId };
    return groups;
  }, {});
  const options = Object.values(groups).map(({ structureName, structureId }) => ({
    text: `${structureName}:`,
    fieldPair: {
      error: 'minimum 4 characters',
      validator: nameValidator(4),
      placeholder: structureName,
      field: structureId,
      id: structureId,
    },
  }));

  let inputs;
  const onClick = () => {
    const structureDetails = Object.values(groups)
      .map(
        ({ structureId }) =>
          inputs[structureId]?.value && { structureId, structureName: inputs[structureId].value.trim() },
      )
      .filter(Boolean);
    const methods = [
      {
        params: { drawId, structureDetails },
        method: RENAME_STRUCTURES,
      },
    ];
    const postMutation = (result) => {
      if (result.success) {
        tmxToast({ message: 'Groups renamed', intent: 'is-success' });
        isFunction(callback) && callback();
      }
    };
    mutationRequest({ methods, callback: postMutation });
  };
  const checkValid = () => {
    const nameValues = Object.values(groups)
      .map(({ structureId }) => inputs[structureId]?.value)
      .filter(Boolean);
    const validValues = nameValues.every(nameValidator(4));
    const renameButton = document.getElementById('renameGroups');
    const valid = nameValues.length && validValues;
    if (renameButton) renameButton.disabled = !valid;
  };
  const relationships = Object.values(groups).map(({ structureId }) => ({
    control: structureId,
    onInput: checkValid,
  }));
  const content = (elem) => (inputs = renderForm(elem, options, relationships));
  openModal({
    title: `Edit group names`,
    content,
    buttons: [
      { label: 'Cancel', intent: NONE, close: true },
      { label: 'Rename', id: 'renameGroups', disabled: true, intent: 'is-info', close: true, onClick },
    ],
  });
}
