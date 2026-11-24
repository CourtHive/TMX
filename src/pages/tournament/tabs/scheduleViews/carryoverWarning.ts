/**
 * The carryover WARNING beside the schedule date selector (CA 2026-11-22, Battle of Boca).
 *
 * Shown only while a past day still holds unresulted matchUps that leave matchUps upstream of them with no date they
 * may take (`carryoverAnalysis.ts`). The button opens a modal naming them and offering to clear their placement, so
 * the stuck rounds can be scheduled today. Clearing is the operator's choice in the modal, never automatic: the
 * placement is the director's work (see the "never destroy operator scheduling" rule).
 *
 * The clear is the interim answer. A PLAN view that compares releasing today's matchUps as players and courts free up
 * with waiting for the carryover to finish is the intended successor (Mentat/planning/boca-rain-plan.html).
 *
 * Like the date selector, the control owns its `onMutationApplied` subscription and re-evaluates after every applied
 * mutation, coalesced to one pass per tick.
 */
import { formatDateLabel } from 'components/schedule/scheduleDateSelectorLogic';
import { openModal, closeModal } from 'components/modals/baseModal/baseModal';
import { analyzeCarryover, type CarryoverItem } from './carryoverAnalysis';
import { onMutationApplied } from 'services/mutation/mutationObservers';
import { openRecoveryModal } from './recovery/recoveryModal';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { getCachedAllMatchUps } from './schedule2DataCache';
import { competitionEngine } from 'services/factory/engine';
import { venueToday } from 'functions/venueTimeFrame';
import { isScheduleLocked } from './scheduleLocks';
import { scheduleToast } from './scheduleToast';
import { featureFlags } from 'config/featureFlags';
import { context } from 'services/context';
import { t } from 'i18n';

import { BULK_SCHEDULE_MATCHUPS } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';

export interface CarryoverWarning {
  element: HTMLElement;
  /** Unsubscribe from mutations. Idempotent. */
  destroy: () => void;
}

const CLEAR_BUTTON_ID = 'carryoverClearSelected';
const CLEAR_PLACEMENT = { courtId: '', venueId: '', courtOrder: '', scheduledDate: '', scheduledTime: '' };

function evaluate() {
  const { matchUps = [] } = getCachedAllMatchUps() ?? {};
  const { matchUpDependencies } = competitionEngine.getMatchUpDependencies({ matchUps }) ?? {};
  return analyzeCarryover({ matchUps, matchUpDependencies, today: venueToday() });
}

export function buildCarryoverWarning(): CarryoverWarning {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tmx-carryover-warning';
  button.hidden = true;

  let destroyed = false;
  let pending = false;

  const render = (): void => {
    pending = false;
    if (destroyed) return;
    const { blocking, heldBackMatchUpIds } = evaluate();
    button.hidden = blocking.length === 0;
    if (button.hidden) return;
    const label = t('schedule.carryover.warning');
    button.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i><span>${label}</span><span class="tmx-carryover-count">${blocking.length}</span>`;
    const title = t('schedule.carryover.tooltip', {
      count: blocking.length,
      blocked: heldBackMatchUpIds.length,
    });
    button.title = title;
    button.setAttribute('aria-label', `${label}: ${title}`);
  };

  button.addEventListener('click', () => openCarryoverModal());

  render();
  const unsubscribe = onMutationApplied(() => {
    if (pending || destroyed) return;
    pending = true;
    setTimeout(render, 0);
  });

  return {
    element: button,
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
    },
  };
}

function sideNames(matchUp: any): string {
  const names = (matchUp?.sides ?? []).map(
    (side: any) => side?.participant?.participantName || t('schedule.carryover.tbd'),
  );
  return names.length ? names.join(' – ') : t('schedule.carryover.tbd');
}

function rowFor(item: CarryoverItem, checked: boolean, onToggle: (id: string, on: boolean) => void): HTMLElement {
  const row = document.createElement('label');
  row.className = 'tmx-carryover-row';

  const box = document.createElement('input');
  box.type = 'checkbox';
  const locked = isScheduleLocked(item.matchUp);
  box.checked = checked && !locked;
  box.disabled = locked;
  box.addEventListener('change', () => onToggle(item.matchUpId, box.checked));

  const when = [formatDateLabel(item.scheduledDate), item.scheduledTime].filter(Boolean).join(' ');
  const what = [item.matchUp?.eventName, item.matchUp?.roundName].filter(Boolean).join(' · ');
  const notes: string[] = [];
  if (item.heldBackMatchUpIds.length) {
    notes.push(t('schedule.carryover.holdsBack', { count: item.heldBackMatchUpIds.length }));
  }
  if (item.underWay) notes.push(t('schedule.carryover.underWay'));
  if (locked) notes.push(t('schedule.carryover.locked'));

  const text = document.createElement('div');
  text.className = 'tmx-carryover-row-text';
  const main = document.createElement('div');
  main.textContent = sideNames(item.matchUp);
  const meta = document.createElement('div');
  meta.className = 'tmx-carryover-row-meta';
  meta.textContent = [when, what, ...notes].filter(Boolean).join(' · ');
  text.append(main, meta);

  row.append(box, text);
  return row;
}

export function openCarryoverModal(): void {
  const { carryover, blocking, heldBackMatchUpIds } = evaluate();
  if (!blocking.length) return;

  // blocking carryover is selected by default, except a match already started; the rest is offered unselected
  const selected = new Set(
    blocking.filter((item) => !item.underWay && !isScheduleLocked(item.matchUp)).map((item) => item.matchUpId),
  );
  const others = carryover.filter((item) => !item.heldBackMatchUpIds.length);

  let modalHandle: any;
  const syncClearButton = () =>
    modalHandle?.setButtonState(CLEAR_BUTTON_ID, {
      disabled: selected.size === 0,
      label: t('schedule.carryover.clearSelected', { count: selected.size }),
    });
  const onToggle = (id: string, on: boolean) => {
    if (on) selected.add(id);
    else selected.delete(id);
    syncClearButton();
  };

  const content = (elem: HTMLElement) => {
    elem.classList.add('tmx-carryover-modal');
    const intro = document.createElement('p');
    intro.textContent = t('schedule.carryover.explanation', {
      count: blocking.length,
      blocked: heldBackMatchUpIds.length,
    });
    const why = document.createElement('p');
    why.className = 'tmx-carryover-why';
    why.textContent = t('schedule.carryover.why');
    elem.append(intro, why);

    const section = (heading: string, items: CarryoverItem[], checked: (item: CarryoverItem) => boolean) => {
      if (!items.length) return;
      const title = document.createElement('div');
      title.className = 'tmx-carryover-heading';
      title.textContent = heading;
      const list = document.createElement('div');
      list.className = 'tmx-carryover-list';
      for (const item of items) list.appendChild(rowFor(item, checked(item), onToggle));
      elem.append(title, list);
    };
    section(t('schedule.carryover.blockingHeading'), blocking, (item) => selected.has(item.matchUpId));
    section(t('schedule.carryover.otherHeading'), others, () => false);

    const note = document.createElement('p');
    note.className = 'tmx-carryover-why';
    note.textContent = t('schedule.carryover.clearNote');
    elem.appendChild(note);
  };

  const onClear = () => {
    const matchUpIds = [...selected];
    closeModal();
    if (!matchUpIds.length) return;
    mutationRequest({
      methods: [
        {
          method: BULK_SCHEDULE_MATCHUPS,
          params: { matchUpIds, schedule: CLEAR_PLACEMENT, removePriorValues: true },
        },
      ],
      callback: (result: any) => {
        if (!result?.success) return;
        scheduleToast({
          message: t('schedule.carryover.cleared', { count: matchUpIds.length }),
          intent: 'is-success',
        });
        context.refreshActiveTable?.();
      },
    });
  };

  modalHandle = openModal({
    title: t('schedule.carryover.title'),
    content,
    config: { padding: '.5', content: { padding: '1' }, maxWidth: 640 },
    buttons: [
      { label: t('common.cancel'), intent: NONE, close: true },
      // the projection Clear stands in for (T5): offered while Plan mode is on (CA 2026-11-23, Q1)
      ...(featureFlags.get().schedulePlan
        ? [
            {
              label: t('schedule.plan.recovery'),
              intent: NONE,
              onClick: () => {
                closeModal();
                openRecoveryModal();
              },
            },
          ]
        : []),
      {
        label: t('schedule.carryover.clearSelected', { count: selected.size }),
        disabled: selected.size === 0,
        intent: 'is-danger',
        id: CLEAR_BUTTON_ID,
        onClick: onClear,
      },
    ],
  });
}
