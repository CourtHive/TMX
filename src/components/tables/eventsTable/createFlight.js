import { mutationRequest } from 'services/mutation/mutationRequest';

import { ADD_FLIGHT } from 'constants/mutationConstants';
import { OVERLAY } from 'constants/tmxConstants';

const newFlight = (table, event) => {
  const selected = table.getSelectedData();
  const participantIds = selected.map(({ participantId }) => participantId);
  const drawEntries = event.entries.filter(({ participantId }) => participantIds.includes(participantId));

  const methods = [
    {
      method: ADD_FLIGHT,
      params: {
        eventId: event.eventId,
        drawName: 'Flight',
        drawEntries
      }
    }
  ];
  const postMutation = (result) => {
    if (result.success) {
      table.deselectRow();
    } else {
      console.log(result.error);
    }
  };
  mutationRequest({ methods, callback: postMutation });
};

export const createFlight = (event, drawId) => (table) => {
  return {
    onClick: () => newFlight(table, event),
    label: 'Add flight',
    location: OVERLAY,
    hide: drawId
  };
};
