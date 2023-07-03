import { deleteParticipants } from 'Pages/Tournament/Tabs/participantTab/deleteParticipants';
import { context } from 'services/context';

export const deleteSelectedParticipants = (table) => {
  const selected = table.getSelectedData();
  const participantIds = selected.filter((p) => !p.events?.length).map(({ participantId }) => participantId);
  const okAction = () => {
    const callback = (result) => result.success && table.deleteRow(participantIds);
    deleteParticipants({ participantIds, callback });
  };
  context.modal.confirm({
    query: `Delete ${participantIds.length} participants?`,
    title: 'Delete participants',
    okIntent: 'is-danger',
    okAction
  });
};
