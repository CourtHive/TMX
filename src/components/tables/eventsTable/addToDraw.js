import { OVERLAY } from 'constants/tmxConstants';

const addTo = (table, eventId, drawId) => {
  const selected = table.getSelectedData();
  const participantIds = selected.filter((p) => !p.events?.length).map(({ participantId }) => participantId);

  /*
  const callback = (result) => {
    if (result?.success) {
      const data = table.getData();
      const targetRows = data.filter(({ participantId }) => participantIds.includes(participantId));
      table.deleteRow(participantIds);
    } else {
      table.deselectRow();
    }
  };
  */
  console.log('add', { participantIds }, 'to', { eventId, drawId });
};

export const addToDraw = (event) => (table) => {
  const options = (event.drawDefinitions || []).map(({ drawName, drawId }) => ({
    onClick: () => addTo(table, event.eventId, drawId),
    stateChange: true,
    label: drawName,
    value: drawId,
    close: true
  }));

  return {
    hide: !event.drawDefinitions?.length,
    label: 'Add to draw',
    location: OVERLAY,
    options
  };
};
