export const createSelectOnEnter = (table) => (e) => {
  if (e.key === 'Enter') {
    const selected = table.getSelectedData();
    const selectedParticipantIds = selected.map(({ participantId }) => participantId);
    const active = table.getData('active');
    const activeParticipantIds = active.map(({ participantId }) => participantId);
    const activeNotSelected = activeParticipantIds.filter((a) => !selectedParticipantIds.includes(a));
    if (activeNotSelected.length === 1) {
      table.selectRow(activeNotSelected);
      e.target.value = '';
      table.clearFilter();
    }
  }
};
