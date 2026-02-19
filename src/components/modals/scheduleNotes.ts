import { renderForm } from 'courthive-components';
import { openModal } from './baseModal/baseModal';
import { t } from 'i18n';

export function editNotes({ notice, notes, callback }: { notice?: string; notes?: string; callback?: (result: any) => void }): void {
  let inputs: any;
  const content = (elem: HTMLElement) => {
    inputs = renderForm(elem, [
      {
        placeholder: t('modals.scheduleNotes.headerPlaceholder'),
        value: notice,
        label: t('schedule.notice'),
        field: 'notice'
      },
      {
        placeholder: t('modals.scheduleNotes.footerPlaceholder'),
        value: notes,
        label: t('schedule.umpirenotes'),
        field: 'notes'
      }
    ]);
  };
  const submit = () => {
    const updatedNotice = inputs.notice.value;
    const updatedNotes = inputs.notes.value;
    if (typeof callback === 'function') callback({ notice: updatedNotice, notes: updatedNotes });
  };
  const buttons = [
    { label: t('common.cancel'), intent: 'is-nothing' },
    { label: t('common.save'), intent: 'is-info', onClick: submit, close: true }
  ];
  openModal({ title: t('modals.scheduleNotes.title'), buttons, content });
}
