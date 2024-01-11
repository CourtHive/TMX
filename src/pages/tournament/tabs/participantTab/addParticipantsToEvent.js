import { mutationRequest } from 'services/mutation/mutationRequest';
import { addToEvent } from 'components/modals/addToEvent';
import { isFunction } from 'functions/typeOf';

import { ADD_EVENT_ENTRIES } from 'constants/mutationConstants';
import { tmxToast } from 'services/notifications/tmxToast';

export function addParticipantsToEvent({ event, participantType, table, callback }) {
  const selected = table.getSelectedData();
  const { eventId, eventName, eventType } = event;
  const participantIds = selected
    .filter((p) => !p.events.map((e) => e.eventId).includes(eventId))
    .map(({ participantId }) => participantId);
  const postAdd = ({ entryStatus, entryStage } = {}) => {
    table.deselectRow();
    const methods = [
      {
        params: { eventId, participantIds, entryStatus, entryStage },
        method: ADD_EVENT_ENTRIES
      }
    ];
    const postMutation = (result) => {
      if (result.success) {
        isFunction(callback) && callback();
      } else {
        console.log(result);
        if (result.misMatchedGender) {
          tmxToast({ intent: 'is-danger', message: 'Invalid gender' });
        }
      }
    };
    mutationRequest({ methods, callback: postMutation });
  };
  addToEvent({ callback: postAdd, eventName, participantType, eventType, participantIds });
}
