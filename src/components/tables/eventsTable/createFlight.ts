/**
 * Create flight from selected entries in an event.
 * Adds a new draw with selected participants as flight entries.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';

import { ADD_FLIGHT } from 'constants/mutationConstants';
import { OVERLAY } from 'constants/tmxConstants';

const newFlight = (table: any, event: any): void => {
  const selected = table.getSelectedData();
  const participantIds = selected.map(({ participantId }: any) => participantId);
  const drawEntries = event.entries.filter(({ participantId }: any) => participantIds.includes(participantId));

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
  const postMutation = (result: any) => {
    if (result.success) {
      table.deselectRow();
    } else {
      console.log(result.error);
    }
  };
  mutationRequest({ methods, callback: postMutation });
};

export const createFlight = (event: any, drawId?: string) => (table: any): any => {
  return {
    onClick: () => newFlight(table, event),
    label: 'Add flight',
    location: OVERLAY,
    hide: drawId
  };
};
