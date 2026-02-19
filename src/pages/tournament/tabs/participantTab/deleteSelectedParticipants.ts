import { deleteParticipants } from 'pages/tournament/tabs/participantTab/deleteParticipants';
import { openModal } from 'components/modals/baseModal/baseModal';
import { t } from 'i18n';

import { NONE } from 'constants/tmxConstants';

export function deleteSelectedParticipants(table: any): void {
  const selected = table.getSelectedData();
  const participantIds = selected.filter((p: any) => !p.events?.length).map(({ participantId }: any) => participantId);
  const okAction = () => {
    const callback = (result: any) => {
      if (result.success) {
        table.deleteRow(participantIds);
        table.deselectRow();
      }
    };
    deleteParticipants({ participantIds, callback });
  };
  openModal({
    content: t('modals.deleteParticipants.content', { count: participantIds.length }),
    onClose: () => table.deselectRow(),
    title: t('modals.deleteParticipants.title'),
    buttons: [
      { label: t('common.cancel'), intent: NONE, close: true },
      { label: t('common.delete'), id: 'deleteDraw', intent: 'is-danger', close: true, onClick: okAction },
    ],
  });
}
