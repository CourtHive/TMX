/**
 * Delete events modal with audit reason requirement.
 * Validates minimum word count before allowing deletion with mutation.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { wordValidator } from 'components/validators/wordValidator';
import { renderForm } from 'courthive-components';
import { openModal } from './baseModal/baseModal';
import { isDev } from 'functions/isDev';

import { DELETE_EVENTS } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';

export function deleteEvents(params: { eventIds: string[]; callback?: (result: any) => void }): void {
  const { eventIds, callback } = params;

  // Skip reason modal if env.skipReason is true
  if (isDev()) {
    const auditData = { auditReason: 'Reason skipped' };
    mutationRequest({ methods: [{ method: DELETE_EVENTS, params: { eventIds, auditData } }], callback });
    return;
  }

  const modalTitle = eventIds.length > 1 ? `Delete Events` : 'Delete Event';

  let inputs: any;
  const deleteAction = () => {
    const auditData = { auditReason: inputs['eventDeletionReason'].value };
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
  const enableSubmit = ({ inputs }: any) => {
    const value = inputs['eventDeletionReason'].value;
    const isValid = wordValidator(5)(value);
    const deleteButton = document.getElementById('deleteEvent');
    if (deleteButton) (deleteButton as HTMLButtonElement).disabled = !isValid;
  };
  const relationships = [
    {
      control: 'eventDeletionReason',
      onInput: enableSubmit,
    },
  ];
  const content = (elem: HTMLElement) => (inputs = renderForm(elem, items, relationships));

  openModal({
    title: modalTitle,
    content,
    buttons: [
      { label: 'Cancel', intent: NONE, close: true },
      { label: 'Delete', id: 'deleteEvent', disabled: true, intent: 'is-danger', close: true, onClick: deleteAction },
    ],
  });
}
