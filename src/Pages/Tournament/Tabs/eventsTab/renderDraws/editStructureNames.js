import { mutationRequest } from 'services/mutation/mutationRequest';
import { nameValidator } from 'components/validators/nameValidator';
import { openModal } from 'components/modals/baseModal/baseModal';
import { renderForm } from 'components/renderers/renderForm';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';

import { RENAME_STRUCTURES } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';

export function editStructureNames({ drawId, callback }) {
  const structures = tournamentEngine.getEvent({ drawId })?.drawDefinition?.structures;
  if (!structures?.length) return;

  const options = structures.map(({ structureName, structureId }) => ({
    text: `${structureName}:`,
    fieldPair: {
      error: 'minimum 4 characters',
      validator: nameValidator(4),
      placeholder: structureName,
      field: structureId,
      id: structureId
    }
  }));

  let inputs;
  const onClick = () => {
    const structureDetails = structures
      .map(
        ({ structureId }) =>
          inputs[structureId]?.value && { structureId, structureName: inputs[structureId].value.trim() }
      )
      .filter(Boolean);
    const methods = [
      {
        params: { drawId, structureDetails },
        method: RENAME_STRUCTURES
      }
    ];
    const postMutation = (result) => {
      if (result.success) {
        tmxToast({ message: 'Structure renamed', intent: 'is-success' });
        isFunction(callback) && callback();
      }
    };
    mutationRequest({ methods, callback: postMutation });
  };
  const checkValid = () => {
    const nameValues = structures.map(({ structureId }) => inputs[structureId]?.value).filter(Boolean);
    const validValues = nameValues.every(nameValidator(4));
    const renameButton = document.getElementById('renameStructures');
    const valid = nameValues.length && validValues;
    if (renameButton) renameButton.disabled = !valid;
  };
  const relationships = structures.map(({ structureId }) => ({
    control: structureId,
    onInput: checkValid
  }));
  const content = (elem) => (inputs = renderForm(elem, options, relationships));
  openModal({
    title: `Edit structure names`,
    content,
    buttons: [
      { label: 'Cancel', intent: NONE, close: true },
      { label: 'Rename', id: 'renameStructures', disabled: true, intent: 'is-info', close: true, onClick }
    ]
  });
}
