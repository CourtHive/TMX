import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

// constants
import { BULK_SCHEDULE_MATCHUPS } from 'constants/mutationConstants';

type SetMatchUpScheduleParams = {
  callback?: () => void;
  matchUpId: string;
  schedule: any;
};

/**
 * Engine rejections that have a better explanation than their raw message. Anything absent falls
 * through to the engine's own text, which is still preferable to the silence this map replaced.
 */
const ERROR_MESSAGE_KEYS: Record<string, string> = {
  ERR_INVALID_END_TIME: 'toasts.schedule.invalidEndTime',
  ERR_INVALID_START_TIME: 'toasts.schedule.invalidStartTime',
  ERR_NOT_FOUND_COURT: 'toasts.schedule.courtNotFound',
  ERR_INVALID_TIME: 'toasts.schedule.invalidTime',
};

export function scheduleErrorMessage(error: any): string {
  const code = typeof error === 'object' ? error?.code : undefined;
  const key = code && ERROR_MESSAGE_KEYS[code];
  if (key) return t(key);

  const reason = (typeof error === 'object' ? error?.message : error) || t('common.error');
  return t('toasts.schedule.notSaved', { reason });
}

export function setMatchUpSchedule(params: SetMatchUpScheduleParams) {
  const { matchUpId, schedule, callback } = params;
  const methods = [
    {
      params: { matchUpIds: [matchUpId], schedule, removePriorValues: true },
      method: BULK_SCHEDULE_MATCHUPS,
    },
  ];

  // `mutationRequest` only toasts a failure when NO callback is supplied, and this function always
  // supplies one — so before this branch existed every rejection here was silent. A schedule edit
  // that the engine refuses now says so.
  const postMutation = (result: any) => {
    if (result?.error) {
      tmxToast({ message: scheduleErrorMessage(result.error), intent: 'is-danger' });
      return;
    }
    if (result?.success && callback && isFunction(callback)) {
      callback();
    }
  };

  mutationRequest({ methods, callback: postMutation });
}
