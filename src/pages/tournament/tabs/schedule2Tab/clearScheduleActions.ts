/**
 * Clear Schedule actions for the Schedule2 grid view.
 *
 * Three options, all scoped to courts visible in gridView (hiddenCourtIds is
 * the operator's "operational scope" — see visibilityState.ts):
 *
 *   1. Clear this day (keep completed)       — active date, exclude COMPLETED
 *   2. Clear this day (including completed)  — active date, include all
 *   3. Clear all schedule data               — every date, include all
 *
 * All three use bulkScheduleMatchUps with empty schedule values + removePriorValues
 * (mirrors the original Schedule page's clearSchedule.ts).
 *
 * When matchUps on hidden courts fall within scope, the confirmation surfaces
 * the count and offers "Show all courts" to clear visibility before proceeding.
 */
import { confirmModal, closeModal } from 'components/modals/baseModal/baseModal';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { competitionEngine } from 'services/factory/engine';
import { isCompletedStatus } from 'courthive-components';
import { tipster } from 'components/popovers/tipster';
import { hiddenCourtIds } from './visibilityState';
import { scheduleToast } from './scheduleToast';

import { BULK_SCHEDULE_MATCHUPS } from 'constants/mutationConstants';
import { BOTTOM } from 'constants/tmxConstants';
import { t } from 'i18n';

const SCOPE = { DAY_PENDING: 'day-pending', DAY_ALL: 'day-all', ALL: 'all' } as const;
type Scope = (typeof SCOPE)[keyof typeof SCOPE];

type OpenClearMenuParams = {
  target: HTMLElement;
  scheduledDate: string;
  onCleared?: () => void;
};

type Bucket = {
  visible: any[];
  hidden: any[];
};

/**
 * Build the three buckets used by both menu (counts) and confirm (execution).
 * "Hidden" = matchUps that fall in the date/status scope but sit on a hidden
 * court — those are *excluded* from the clear and surfaced as a warning so
 * the operator can broaden scope before proceeding.
 */
function buildBuckets(scheduledDate: string): Record<Scope, Bucket> {
  const result = competitionEngine.competitionScheduleMatchUps({ courtCompletedMatchUps: true });
  const matchUps: any[] = (result?.dateMatchUps ?? []).concat(result?.completedMatchUps ?? []);

  const isScheduled = ({ schedule }: any) =>
    !!(schedule?.scheduledDate || schedule?.scheduledTime || schedule?.courtId || schedule?.courtOrder);

  const scheduled = matchUps.filter(isScheduled);

  const onHiddenCourt = (m: any) => !!m.schedule?.courtId && hiddenCourtIds.has(m.schedule.courtId);
  const isOnDate = (m: any) => m.schedule?.scheduledDate === scheduledDate;
  const isPending = (m: any) => !isCompletedStatus(m.matchUpStatus) && !m.winningSide;

  const split = (filter: (m: any) => boolean): Bucket => {
    const inScope = scheduled.filter(filter);
    return {
      visible: inScope.filter((m) => !onHiddenCourt(m)),
      hidden: inScope.filter(onHiddenCourt),
    };
  };

  return {
    [SCOPE.DAY_PENDING]: split((m) => isOnDate(m) && isPending(m)),
    [SCOPE.DAY_ALL]: split(isOnDate),
    [SCOPE.ALL]: split(() => true),
  };
}

const CLEAR_SCHEDULE: any = {
  schedule: { courtId: '', scheduledDate: '', courtOrder: '', scheduledTime: '', venueId: '' },
  removePriorValues: true,
};

function executeClear(matchUps: any[], includeCompleted: boolean, onCleared?: () => void): void {
  const matchUpIds = matchUps.map((m) => m.matchUpId);
  if (!matchUpIds.length) return;

  // bulkScheduleMatchUps silently skips COMPLETED matchUps unless scheduleCompletedMatchUps is true,
  // which leaves their schedule assignment intact even on an explicit "clear" request.
  const params: any = { ...CLEAR_SCHEDULE, matchUpIds };
  if (includeCompleted) params.scheduleCompletedMatchUps = true;

  mutationRequest({
    methods: [{ method: BULK_SCHEDULE_MATCHUPS, params }],
    callback: (result: any) => {
      if (result?.success) {
        scheduleToast({
          message: t('toasts.scheduleCleared', { count: matchUpIds.length, defaultValue: `Cleared ${matchUpIds.length} matchUps` }),
          intent: 'is-success',
        });
        onCleared?.();
      }
    },
  });
}

function buildConfirmContent(bucket: Bucket, summary: string, onShowAllCourts: () => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display: flex; flex-direction: column; gap: 10px; font-size: 0.875rem;';

  const summaryLine = document.createElement('div');
  summaryLine.textContent = summary;
  wrap.appendChild(summaryLine);

  if (bucket.hidden.length > 0) {
    const warn = document.createElement('div');
    warn.style.cssText = [
      'display: flex',
      'flex-direction: column',
      'gap: 6px',
      'padding: 10px 12px',
      'border: 1px solid var(--tmx-panel-yellow-border, #f59e0b)',
      'background: var(--tmx-panel-yellow-bg, rgba(245,158,11,0.08))',
      'border-radius: 6px',
      'font-size: 0.8125rem',
    ].join('; ');

    const msg = document.createElement('div');
    msg.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="margin-right:6px; color: var(--tmx-panel-yellow-border, #f59e0b);"></i>` +
      `<strong>${bucket.hidden.length}</strong> matchUp${bucket.hidden.length === 1 ? '' : 's'} on hidden courts will not be cleared.`;
    warn.appendChild(msg);

    const showAllBtn = document.createElement('button');
    showAllBtn.type = 'button';
    showAllBtn.className = 'button is-light is-small';
    showAllBtn.style.cssText = 'align-self: flex-start; font-size: 0.75rem;';
    showAllBtn.innerHTML = '<i class="fa-solid fa-eye" style="margin-right:6px;"></i>Show all courts and re-evaluate';
    showAllBtn.addEventListener('click', onShowAllCourts);
    warn.appendChild(showAllBtn);

    wrap.appendChild(warn);
  }

  return wrap;
}

function summaryFor(scope: Scope, bucket: Bucket, scheduledDate: string): { title: string; summary: string } {
  const n = bucket.visible.length;
  switch (scope) {
    case SCOPE.DAY_PENDING:
      return {
        title: 'Clear this day (keep completed)',
        summary: `Will clear ${n} pending matchUp${n === 1 ? '' : 's'} on ${scheduledDate}. Completed matchUps are preserved.`,
      };
    case SCOPE.DAY_ALL:
      return {
        title: 'Clear this day (including completed)',
        summary: `Will clear ${n} matchUp${n === 1 ? '' : 's'} on ${scheduledDate} — including completed results.`,
      };
    case SCOPE.ALL: {
      const dates = new Set(bucket.visible.map((m) => m.schedule?.scheduledDate).filter(Boolean));
      return {
        title: 'Clear all schedule data',
        summary: `Will clear ${n} matchUp${n === 1 ? '' : 's'} across ${dates.size} date${dates.size === 1 ? '' : 's'} — every scheduling assignment is removed.`,
      };
    }
  }
}

function openConfirm(scope: Scope, scheduledDate: string, params: OpenClearMenuParams): void {
  const buckets = buildBuckets(scheduledDate);
  const bucket = buckets[scope];
  if (!bucket.visible.length) {
    scheduleToast({ message: 'No matchUps to clear in this scope.', intent: 'is-info' });
    return;
  }

  const { title, summary } = summaryFor(scope, bucket, scheduledDate);
  const okIntent = scope === SCOPE.ALL ? 'is-danger' : 'is-warning';

  const reopen = () => {
    closeModal();
    hiddenCourtIds.clear();
    // Defer one tick so the previous modal teardown completes before reopening.
    setTimeout(() => openConfirm(scope, scheduledDate, params), 0);
  };

  confirmModal({
    title,
    query: buildConfirmContent(bucket, summary, reopen),
    okIntent,
    okAction: () => executeClear(bucket.visible, scope !== SCOPE.DAY_PENDING, params.onCleared),
    cancelAction: undefined,
  });
}

export function openClearScheduleMenu(params: OpenClearMenuParams): void {
  const { target, scheduledDate } = params;
  const buckets = buildBuckets(scheduledDate);

  const labelWithCount = (text: string, n: number) => {
    const suffix = n ? ` — ${n}` : '';
    return `${text}${suffix}`;
  };

  const options = [
    {
      disabled: !buckets[SCOPE.DAY_PENDING].visible.length,
      option: labelWithCount('Clear this day (keep completed)', buckets[SCOPE.DAY_PENDING].visible.length),
      onClick: () => openConfirm(SCOPE.DAY_PENDING, scheduledDate, params),
    },
    {
      disabled: !buckets[SCOPE.DAY_ALL].visible.length,
      option: labelWithCount('Clear this day (including completed)', buckets[SCOPE.DAY_ALL].visible.length),
      onClick: () => openConfirm(SCOPE.DAY_ALL, scheduledDate, params),
    },
    {
      disabled: !buckets[SCOPE.ALL].visible.length,
      option: labelWithCount('Clear all schedule data', buckets[SCOPE.ALL].visible.length),
      onClick: () => openConfirm(SCOPE.ALL, scheduledDate, params),
    },
  ];

  if (!options.filter((o) => !o.disabled).length) {
    scheduleToast({ message: 'Nothing scheduled on visible courts.', intent: 'is-info' });
    return;
  }

  tipster({ target, options, config: { placement: BOTTOM } });
}
