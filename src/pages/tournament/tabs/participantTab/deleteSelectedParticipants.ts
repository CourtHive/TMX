import { deleteParticipants } from 'pages/tournament/tabs/participantTab/deleteParticipants';
import { openModal } from 'components/modals/baseModal/baseModal';
import { tmxToast } from 'services/notifications/tmxToast';
import { t } from 'i18n';

import { NONE } from 'constants/tmxConstants';

export function deleteSelectedParticipants(table: any): void {
  const activeIds = new Set(table.getData('active').map((a: any) => a.participantId));
  const selected = table.getSelectedData().filter((s: any) => activeIds.has(s.participantId));
  const deletable = selected.filter((p: any) => !p.events?.length);
  const inDraws = selected.length - deletable.length;
  const participantIds = deletable.map(({ participantId }: any) => participantId);

  const okAction = () => {
    const callback = (result: any) => {
      if (result.success) {
        table.deleteRow(participantIds);
        table.deselectRow();
      } else {
        tmxToast({ message: result.error?.message || 'Cannot delete participants', intent: 'is-danger' });
      }
    };
    deleteParticipants({ participantIds, callback });
  };

  let content = '';
  if (inDraws) {
    content += `<p>${t('modals.deleteParticipants.inDraws', { count: inDraws })}</p>`;
  }
  if (participantIds.length) {
    content += `<p>${t('modals.deleteParticipants.content', { count: participantIds.length })}</p>`;
  }

  const buttons: any[] = [{ label: t('common.cancel'), intent: NONE, close: true }];
  if (participantIds.length) {
    buttons.push({ label: t('common.delete'), id: 'deleteDraw', intent: 'is-danger', close: true, onClick: okAction });
  }

  openModal({
    content,
    onClose: () => table.deselectRow(),
    title: t('modals.deleteParticipants.title'),
    buttons,
  });
}
