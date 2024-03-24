import { mutationRequest } from 'services/mutation/mutationRequest';
import { isFunction } from 'functions/typeOf';

// constants
import { BULK_SCHEDULE_MATCHUPS } from 'constants/mutationConstants';

type SetMatchUpScheduleParams = {
  callback?: () => void;
  matchUpId: string;
  schedule: any;
};
export function setMatchUpSchedule(params: SetMatchUpScheduleParams) {
  const { matchUpId, schedule, callback } = params;
  const methods = [
    {
      params: { matchUpIds: [matchUpId], schedule },
      method: BULK_SCHEDULE_MATCHUPS,
    },
  ];

  const postMutation = (result) => {
    if (result.success) {
      isFunction(callback) && callback();
    }
  };

  mutationRequest({ methods, callback: postMutation });
}
