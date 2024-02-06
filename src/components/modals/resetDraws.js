import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { wordValidator } from 'components/validators/wordValidator';
import { renderForm } from 'components/renderers/renderForm';
import { openModal } from './baseModal/baseModal';

import { RESET_DRAW_DEFINITION } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';

export function resetDraws({ eventData, drawIds }) {
  const eventId = eventData.eventInfo.eventId;
  const drawName = drawIds.length === 1 && eventData?.drawsData?.find((data) => drawIds.includes(data.drawId)).drawName;
  const modalTitle = drawName ? `Delete ${drawName}` : 'Delete flights';

  let inputs;
  const deleteAction = () => {
    const auditData = { auditReason: inputs['drawDeletionReason'].value };
    const methods = drawIds.map((drawId) => ({
      params: { eventId, drawId, auditData },
      method: RESET_DRAW_DEFINITION,
    }));
    const postMutation = (result) => result.success && navigateToEvent({ eventId, drawId: drawIds[0] });
    mutationRequest({ methods, callback: postMutation });
  };
  const items = [
    {
      text: `Please provide a reason for resetting draws.`,
    },
    {
      placeholder: 'Explanation',
      field: 'drawDeletionReason',
      validator: wordValidator(5),
      error: 'Five word minimum',
      autocomplete: 'on',
      focus: true,
    },
    {
      text: `This action cannot be undone!`,
    },
  ];
  const enableSubmit = ({ inputs }) => {
    const value = inputs['drawDeletionReason'].value;
    const isValid = wordValidator(5)(value);
    const deleteButton = document.getElementById('deleteDraw');
    if (deleteButton) deleteButton.disabled = !isValid;
  };
  const relationships = [
    {
      control: 'drawDeletionReason',
      onInput: enableSubmit,
    },
  ];
  const content = (elem) => (inputs = renderForm(elem, items, relationships));

  openModal({
    title: modalTitle,
    content,
    buttons: [
      { label: 'Cancel', intent: NONE, close: true },
      { label: 'Delete', id: 'deleteDraw', disabled: true, intent: 'is-danger', close: true, onClick: deleteAction },
    ],
  });
}
