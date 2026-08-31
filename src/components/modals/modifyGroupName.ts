/**
 * Modify group name modal.
 * Renders form to update bracket/group name.
 */
import { renderForm } from 'courthive-components';
import { openModal } from './baseModal/baseModal';
import { t } from 'i18n';

export function modifyGroupName({ bracket }: { bracket: any }): void {
  const value = bracket?.name || '';
  const submitRRname = ({ content }: any) => {
    const name = content?.newName.value;
    bracket.name = name;
    // mutationRequest({
  };

  const content = (elem: HTMLElement) =>
    renderForm(elem, [
      {
        value,
        label: t('ui.newName'),
        field: 'newName',
      },
    ]);

  openModal({
    title: t('nm'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      { label: t('modals.editProvider.update'), intent: 'is-primary', onClick: submitRRname as any, close: true },
    ],
  });
}
