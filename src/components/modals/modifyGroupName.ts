/**
 * Modify group name modal.
 * Renders form to update bracket/group name.
 */
import { renderForm } from 'courthive-components';
import { openModal } from './baseModal/baseModal';
import { lang } from 'services/translator';

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
        label: 'New name',
        field: 'newName',
      },
    ]);

  openModal({
    title: lang.tr('nm'),
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Update', intent: 'is-primary', onClick: submitRRname as any, close: true },
    ],
  });
}
