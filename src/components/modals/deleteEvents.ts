/**
 * Delete events modal with audit reason requirement.
 * Validates minimum word count before allowing deletion with mutation.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { validators, renderForm } from 'courthive-components';
import { openModal } from './baseModal/baseModal';
import { isDev } from 'functions/isDev';
import { t } from 'i18n';

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

  const modalTitle = eventIds.length > 1 ? t('modals.deleteEvents.titleOther') : t('modals.deleteEvents.titleOne');

  let inputs: any;
  const deleteAction = () => {
    const auditData = { auditReason: inputs['eventDeletionReason'].value };
    mutationRequest({ methods: [{ method: DELETE_EVENTS, params: { eventIds, auditData } }], callback });
  };
  const items = [
    {
      text: t('modals.deleteEvents.reasonPrompt'),
    },
    {
      placeholder: 'Explanation',
      field: 'eventDeletionReason',
      validator: validators.wordValidator(5),
      error: t('modals.deleteEvents.fiveWordMinimum'),
      autocomplete: 'on',
      focus: true,
    },
    {
      text: t('common.cannotBeUndone'),
    },
  ];
  const enableSubmit = ({ inputs }: any) => {
    const value = inputs['eventDeletionReason'].value;
    const isValid = validators.wordValidator(5)(value);
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
      { label: t('common.cancel'), intent: NONE, close: true },
      { label: t('common.delete'), id: 'deleteEvent', disabled: true, intent: 'is-danger', close: true, onClick: deleteAction },
    ],
  });
}
