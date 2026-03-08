import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';

import { DELETE_PARTICIPANTS } from 'constants/mutationConstants';

type DeleteParticipantsParams = {
  participantIds?: string[];
  participantId?: string;
  callback?: (result: any) => void;
};

export async function deleteParticipants({ participantIds, participantId, callback }: DeleteParticipantsParams): Promise<void> {
  if (participantId || participantIds) {
    const methods = [
      {
        params: { participantIds: participantIds || [participantId] },
        method: DELETE_PARTICIPANTS,
      },
    ];

    const postMutation = (result: any) => {
      if (isFunction(callback) && callback) {
        callback(result);
      } else if (!result.success) {
        tmxToast({ message: result.error?.message || 'Cannot delete participant', intent: 'is-danger' });
      }
    };
    mutationRequest({ methods, callback: postMutation });
  }
}
