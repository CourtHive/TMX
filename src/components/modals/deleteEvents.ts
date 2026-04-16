/**
 * Delete events modal with audit reason requirement.
 * Always opens a confirmation modal — even in dev mode, where we prefill the
 * audit reason but still require the TD to click Delete deliberately. When
 * many or all events are selected, shows an additional emphasized warning.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { validators, renderForm } from 'courthive-components';
import { tournamentEngine } from 'tods-competition-factory';
import { openModal } from './baseModal/baseModal';
import { isDev } from 'functions/isDev';
import { t } from 'i18n';

import { DELETE_EVENTS } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';

export function deleteEvents(params: { eventIds: string[]; callback?: (result: any) => void }): void {
  const { eventIds, callback } = params;
  if (!eventIds?.length) return;

  const devMode = isDev();
  const totalEvents = tournamentEngine.getEvents()?.events?.length ?? eventIds.length;
  const deletingAll = eventIds.length === totalEvents;
  const isBulk = eventIds.length >= 5 || deletingAll;

  const modalTitle = eventIds.length > 1 ? t('modals.deleteEvents.titleOther') : t('modals.deleteEvents.titleOne');

  let inputs: any;
  const deleteAction = () => {
    const auditData = { auditReason: inputs['eventDeletionReason'].value };
    mutationRequest({ methods: [{ method: DELETE_EVENTS, params: { eventIds, auditData } }], callback });
  };

  const items: any[] = [];

  // Elevated warning for bulk deletes
  if (isBulk) {
    const warningText = deletingAll
      ? `⚠️ You are about to delete ALL ${eventIds.length} events in this tournament.`
      : `⚠️ You are about to delete ${eventIds.length} events.`;
    items.push({
      text: warningText,
      style: 'color: var(--tmx-accent-red, #f14668); font-weight: 600; padding: 0.5em 0;',
    });
  }

  items.push(
    { text: t('modals.deleteEvents.reasonPrompt') },
    {
      placeholder: 'Explanation',
      field: 'eventDeletionReason',
      value: devMode ? 'this is only a test' : undefined,
      validator: validators.wordValidator(5),
      error: t('modals.deleteEvents.fiveWordMinimum'),
      autocomplete: 'on',
      focus: true,
    },
    { text: t('common.cannotBeUndone') },
  );

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
      {
        label: t('common.delete'),
        id: 'deleteEvent',
        disabled: !devMode,
        intent: 'is-danger',
        close: true,
        onClick: deleteAction,
      },
    ],
  });
}
