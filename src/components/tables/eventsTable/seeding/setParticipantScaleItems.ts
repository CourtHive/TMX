import { mutationRequest } from 'services/mutation/mutationRequest';
import { scaleConstants } from 'tods-competition-factory';
import { isFunction } from 'functions/typeOf';

import { SET_PARTICIPANT_SCALE_ITEMS } from 'constants/mutationConstants';

const { SEEDING } = scaleConstants;

type SetParticipantScaleItemsParams = {
  scaleItemsWithParticipantIds: any[];
  scaleBasis: string;
  eventId: string;
  callback?: () => void;
};

export function setParticipantScaleItems({ scaleItemsWithParticipantIds, scaleBasis, eventId, callback }: SetParticipantScaleItemsParams): void {
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

  const postMutation = (result: any) => {
    if (result.success) {
      isFunction(callback) && callback && callback();
    }
  };

  mutationRequest({ methods, callback: postMutation });
}
