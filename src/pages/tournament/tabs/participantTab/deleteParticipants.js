import { mutationRequest } from 'services/mutation/mutationRequest';
import { isFunction } from 'functions/typeOf';

import { DELETE_PARTICIPANTS } from 'constants/mutationConstants';

export async function deleteParticipants({ participantIds, participantId, callback }) {
  if (participantId || participantIds) {
    const methods = [
      {
        params: { participantIds: participantIds || [participantId] },
        method: DELETE_PARTICIPANTS,
      },
    ];

    const postMutation = (result) => {
      if (result.success) {
        isFunction(callback) && callback(result);
      } else {
        console.log({ result });
      }
    };
    mutationRequest({ methods, callback: postMutation });
  }
}
