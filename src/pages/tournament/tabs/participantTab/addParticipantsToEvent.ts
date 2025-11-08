/**
 * Add participants to events with entry status configuration.
 * Filters out participants already in the event and prompts for entry status/stage.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { addToEvent } from 'components/modals/addToEvent';
import { isFunction } from 'functions/typeOf';

import { ADD_EVENT_ENTRIES } from 'constants/mutationConstants';
import { tmxToast } from 'services/notifications/tmxToast';

type AddParticipantsToEventParams = {
  event: any;
  participantType: string;
  table: any;
  callback?: () => void;
};

export function addParticipantsToEvent({ event, participantType, table, callback }: AddParticipantsToEventParams): void {
  const selected = table.getSelectedData();
  const { eventId, eventName, eventType } = event;
  const participantIds = selected
    .filter((p: any) => !p.events.map((e: any) => e.eventId).includes(eventId))
    .map(({ participantId }: any) => participantId);
  const postAdd = ({ entryStatus, entryStage }: any = {}) => {
    table.deselectRow();
    const methods = [
      {
        params: { eventId, participantIds, entryStatus, entryStage },
        method: ADD_EVENT_ENTRIES,
      },
    ];
    const postMutation = (result: any) => {
      if (result.success) {
        isFunction(callback) && callback && callback();
      } else {
        console.log({ result });
        if (result.misMatchedGender) {
          tmxToast({ intent: 'is-danger', message: 'Invalid gender' });
        }
      }
    };
    mutationRequest({ methods, callback: postMutation });
  };
  addToEvent({ callback: postAdd, eventName, participantType, eventType, participantIds } as any);
}
