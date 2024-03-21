import { mutationRequest } from 'services/mutation/mutationRequest';
import { wordValidator } from 'components/validators/wordValidator';
import { renderForm } from 'components/renderers/renderForm';
import { openModal } from './baseModal/baseModal';

// constants
import { DELETE_EVENTS } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';

export function deleteEvents(params) {
  const { eventIds, callback } = params;
  const modalTitle = eventIds.length > 1 ? `Delete Events` : 'Delete Event';

  let inputs;
  const deleteAction = () => {
    const auditData = { auditReason: inputs['drawDeletionReason'].value };
    mutationRequest({ methods: [{ method: DELETE_EVENTS, params: { eventIds, auditData } }], callback });
  };
  const items = [
    {
      text: `Please provide a reason for event deletion.`,
    },
    {
      placeholder: 'Explanation',
      field: 'eventDeletionReason',
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
    const value = inputs['eventDeletionReason'].value;
    const isValid = wordValidator(5)(value);
    const deleteButton = document.getElementById('deleteEvent');
    if (deleteButton) deleteButton.disabled = !isValid;
  };
  const relationships = [
    {
      control: 'eventDeletionReason',
      onInput: enableSubmit,
    },
  ];
  const content = (elem) => (inputs = renderForm(elem, items, relationships));

  openModal({
    title: modalTitle,
    content,
    buttons: [
      { label: 'Cancel', intent: NONE, close: true },
      { label: 'Delete', id: 'deleteEvent', disabled: true, intent: 'is-danger', close: true, onClick: deleteAction },
    ],
  });
}
