import { mutationRequest } from 'services/mutation/mutationRequest';
import { scaleConstants } from 'tods-competition-factory';
import { isFunction } from 'functions/typeOf';

import { SET_PARTICIPANT_SCALE_ITEMS } from 'constants/mutationConstants';

const { SEEDING } = scaleConstants;

export function setParticipantScaleItems({ scaleItemsWithParticipantIds, scaleBasis, eventId, callback }) {
  const methods = [
    {
      method: SET_PARTICIPANT_SCALE_ITEMS,
      params: {
        scaleItemsWithParticipantIds,
        removePriorValues: true,
        context: {
          scaleAttributes: { scaleType: SEEDING },
          scaleBasis: { scaleType: scaleBasis },
          eventId,
        },
      },
    },
  ];

  const postMutation = (result) => {
    if (result.success) {
      isFunction(callback) && callback();
    }
  };

  mutationRequest({ methods, callback: postMutation });
}
