/**
 * Bulk Lock / Unlock for the Schedule2 grid view.
 *
 * Locking one matchUp at a time is fine for the two marquee matches; a director
 * who has just finished arranging a day wants to pin the lot. Two actions,
 * scoped exactly like the Clear menu beside it — the active date, and only
 * courts currently visible in the grid (`hiddenCourtIds` is the operator's
 * working scope, see visibilityState.ts):
 *
 *   1. Lock this day    — every unlocked matchUp that HAS a placement
 *   2. Unlock this day  — every matchUp currently locked
 *
 * The counts come from the same factory predicate the engine enforces with, so
 * "will lock 14" means fourteen locks actually get written. Completed matchUps
 * and unplaced ones are excluded by `canToggleScheduleLock`, because a lock on
 * either is inert.
 *
 * This is an explicit operator action over an explicit scope — NOT criteria
 * locking. Nothing here is a standing rule; re-arranging the day does not
 * re-apply anything. See planning/SCHEDULE_LOCK_RULES.md for that (unbuilt).
 */
import { buildScheduleLockMethod, canToggleScheduleLock, isScheduleLocked } from './scheduleLocks';
import { confirmModal } from 'components/modals/baseModal/baseModal';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { competitionEngine } from 'services/factory/engine';
import { tipster } from 'components/popovers/tipster';
import { hiddenCourtIds } from './visibilityState';
import { scheduleToast } from './scheduleToast';

import { BOTTOM } from 'constants/tmxConstants';
import { t } from 'i18n';

type OpenLockMenuParams = {
  target: HTMLElement;
  scheduledDate: string;
  onChanged?: () => void;
};

/** MatchUps on the active date and on a visible court, split by lock state. */
export function buildLockBuckets(scheduledDate: string): { lockable: any[]; unlockable: any[] } {
  const result = competitionEngine.competitionScheduleMatchUps({ courtCompletedMatchUps: true });
  const matchUps: any[] = (result?.dateMatchUps ?? []).concat(result?.completedMatchUps ?? []);

  const onVisibleCourt = (m: any) => !(m.schedule?.courtId && hiddenCourtIds.has(m.schedule.courtId));
  const inScope = matchUps.filter((m) => m.schedule?.scheduledDate === scheduledDate && onVisibleCourt(m));

  return {
    // `canToggleScheduleLock` already excludes completed and unplaced matchUps,
    // so these counts equal the number of locks that will actually be written.
    lockable: inScope.filter((m) => canToggleScheduleLock(m) && !isScheduleLocked(m)),
    unlockable: inScope.filter((m) => isScheduleLocked(m)),
  };
}

function applyLockChange(matchUps: any[], locked: boolean, onChanged?: () => void): void {
  const methods = matchUps
    .filter((m) => m.matchUpId && m.drawId)
    .map((m) => buildScheduleLockMethod({ matchUpId: m.matchUpId, drawId: m.drawId, locked }));
  if (!methods.length) return;

  mutationRequest({
    methods,
    callback: (result: any) => {
      if (!result?.success) return;
      scheduleToast({
        message: locked
          ? t('schedule.lockedCount', { count: methods.length })
          : t('schedule.unlockedCount', { count: methods.length }),
        intent: 'is-success',
      });
      onChanged?.();
    },
  });
}

function confirmLockChange(matchUps: any[], locked: boolean, params: OpenLockMenuParams): void {
  confirmModal({
    title: locked ? t('schedule.lockDayTitle') : t('schedule.unlockDayTitle'),
    query: locked
      ? t('schedule.lockDayConfirm', { count: matchUps.length, date: params.scheduledDate })
      : t('schedule.unlockDayConfirm', { count: matchUps.length, date: params.scheduledDate }),
    okIntent: 'is-warning',
    okAction: () => applyLockChange(matchUps, locked, params.onChanged),
    cancelAction: undefined,
  });
}

export function openScheduleLockMenu(params: OpenLockMenuParams): void {
  const { target, scheduledDate } = params;
  const { lockable, unlockable } = buildLockBuckets(scheduledDate);

  if (!lockable.length && !unlockable.length) {
    scheduleToast({ message: t('schedule.nothingToLock'), intent: 'is-info' });
    return;
  }

  const withCount = (label: string, count: number) => (count ? `${label} — ${count}` : label);

  const options = [
    {
      disabled: !lockable.length,
      option: withCount(t('schedule.lockDay'), lockable.length),
      onClick: () => confirmLockChange(lockable, true, params),
    },
    {
      disabled: !unlockable.length,
      option: withCount(t('schedule.unlockDay'), unlockable.length),
      onClick: () => confirmLockChange(unlockable, false, params),
    },
  ];

  tipster({ target, options, config: { placement: BOTTOM } });
}
