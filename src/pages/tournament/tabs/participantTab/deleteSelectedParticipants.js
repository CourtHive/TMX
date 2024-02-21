import { deleteParticipants } from 'pages/tournament/tabs/participantTab/deleteParticipants';
import { openModal } from 'components/modals/baseModal/baseModal';

import { NONE } from 'constants/tmxConstants';

export function deleteSelectedParticipants(table) {
  const selected = table.getSelectedData();
  const participantIds = selected.filter((p) => !p.events?.length).map(({ participantId }) => participantId);
  const okAction = () => {
    const callback = (result) => {
      result.success && table.deleteRow(participantIds) && table.deselectRow();
    };
    deleteParticipants({ participantIds, callback });
  };
  openModal({
    title: 'Delete participants',
    content: `Delete ${participantIds.length} participants?`,
    buttons: [
      { label: 'Cancel', intent: NONE, close: true },
      { label: 'Delete', id: 'deleteDraw', intent: 'is-danger', close: true, onClick: okAction },
    ],
  });
}
