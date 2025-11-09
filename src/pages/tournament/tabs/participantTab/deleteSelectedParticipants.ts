import { deleteParticipants } from 'pages/tournament/tabs/participantTab/deleteParticipants';
import { openModal } from 'components/modals/baseModal/baseModal';

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
    content: `Delete ${participantIds.length} participants?`,
    onClose: () => table.deselectRow(),
    title: 'Delete participants',
    buttons: [
      { label: 'Cancel', intent: NONE, close: true },
      { label: 'Delete', id: 'deleteDraw', intent: 'is-danger', close: true, onClick: okAction },
    ],
  });
}
