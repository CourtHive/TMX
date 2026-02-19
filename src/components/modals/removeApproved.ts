/**
 * Remove approved participants modal.
 * Allows selection of team(s) to remove approved participants from.
 */
import { renderForm } from 'courthive-components';
import { openModal } from './baseModal/baseModal';
import { t } from 'i18n';

const NO_SELECTION = '-';

export function removeApproved({ teams, callback }: { teams: any[]; callback: (params: any) => void }): void {
  const options = ([{ label: t('allteams'), value: NO_SELECTION }] as any[]).concat(
    teams.map((t) => ({ label: t.name, value: t.id || t.uuid }))
  );

  const content = (elem: HTMLElement) =>
    renderForm(elem, [
      {
        value: NO_SELECTION,
        label: t('modals.removeApproved.selectTeams'),
        field: 'selection',
        options
      }
    ]);

  const removeSelection = ({ content }: any) => {
    const selected = content?.selection.value;
    callback({ selected });
  };

  openModal({
    title: t('modals.removeApproved.title'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      { label: t('remove'), intent: 'is-danger', onClick: removeSelection as any, close: true }
    ],
    onClose: () => console.log('update approved')
  });
}
