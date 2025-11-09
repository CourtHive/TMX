import { mutationRequest } from 'services/mutation/mutationRequest';
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
      if (result.success) {
        isFunction(callback) && callback && callback(result);
      } else {
        console.log({ result });
      }
    };
    mutationRequest({ methods, callback: postMutation });
  }
}
