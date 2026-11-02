import { playedOrderRefusalMessage } from 'services/scheduling/playedOrderRefusal';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

// constants and types
import { BULK_SCHEDULE_MATCHUPS } from 'constants/mutationConstants';
import type { ErrorCode } from 'tods-competition-factory';

type SetMatchUpScheduleParams = {
  callback?: () => void;
  matchUpId: string;
  schedule: any;
};

/**
 * Engine rejections that have a better explanation than their raw message. Anything absent falls
 * through to the engine's own text, which is still preferable to the silence this map replaced.
 * Keyed by `ErrorCode`, so a key the factory does not define fails to compile.
 */
const ERROR_MESSAGE_KEYS: Partial<Record<ErrorCode, string>> = {
  ERR_INVALID_END_TIME: 'toasts.schedule.invalidEndTime',
  ERR_INVALID_START_TIME: 'toasts.schedule.invalidStartTime',
  ERR_NOT_FOUND_COURT: 'toasts.schedule.courtNotFound',
  ERR_INVALID_TIME: 'toasts.schedule.invalidTime',
};

export function scheduleErrorMessage(error: any): string {
  const code = typeof error === 'object' ? error?.code : undefined;
  const key = code && ERROR_MESSAGE_KEYS[code as ErrorCode];
  if (key) return t(key);

  const reason = (typeof error === 'object' ? error?.message : error) || t('common.error');
  return t('toasts.schedule.notSaved', { reason });
}

/**
 * `bulkScheduleMatchUps` reports a matchUp it did not write as a SUCCESS with `scheduled: 0`: a skipped one (a BYE, or a
 * completed matchUp without the opt-in), a locked one, or one it could not find. For a single explicit edit that is a
 * refusal, so it gets a message rather than a row showing a value that was never stored (CA, 2026-10-30).
 * Undefined when the write landed, or when the result carries no per-method outcome to judge.
 */
export function notScheduledMessage(result: any): string | undefined {
  const outcome = result?.results?.[0];
  if (!outcome || outcome.scheduled !== 0) return undefined;
  if (outcome.lockedMatchUpIds?.length) return t('toasts.schedule.locked');
  if (outcome.skippedMatchUpIds?.length) return t('toasts.schedule.skipped');
  if (outcome.notFoundMatchUpIds?.length) return t('toasts.schedule.matchUpNotFound');
  return undefined;
}

export function setMatchUpSchedule(params: SetMatchUpScheduleParams) {
  const { matchUpId, schedule, callback } = params;
  const methods = [
    {
      // One explicit edit of one matchUp: a completed matchUp's date, times and official remain editable after the
      // fact, so it opts in. Without it the engine skips the matchUp and still reports success. The played-order
      // rule still applies to the write.
      params: { matchUpIds: [matchUpId], schedule, removePriorValues: true, scheduleCompletedMatchUps: true },
      method: BULK_SCHEDULE_MATCHUPS,
    },
  ];

  // `mutationRequest` only toasts a failure when NO callback is supplied, and this function always
  // supplies one — so before this branch existed every rejection here was silent. A schedule edit
  // that the engine refuses now says so.
  const postMutation = (result: any) => {
    if (result?.error) {
      tmxToast({
        message: playedOrderRefusalMessage(result) ?? scheduleErrorMessage(result.error),
        intent: 'is-danger',
      });
      return;
    }
    const notScheduled = notScheduledMessage(result);
    if (notScheduled) {
      tmxToast({ message: notScheduled, intent: 'is-danger' });
      return;
    }
    if (result?.success && callback && isFunction(callback)) {
      callback();
    }
  };

  mutationRequest({ methods, callback: postMutation });
}
