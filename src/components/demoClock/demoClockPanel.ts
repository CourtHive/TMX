import { hasUnsavedChanges, isAvailabilityDirty } from 'services/schedulingWorkspace/queueService';
import { venueCalendarDate, venueClock, venueTimeZone } from 'functions/venueTimeFrame';
import { hasUnsavedGridChanges } from 'pages/tournament/tabs/scheduleViews/gridView';
import { onMutationApplied } from 'services/mutation/mutationObservers';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'services/factory/engine';
import { context } from 'services/context';
import { t } from 'i18n';
import {
  advanceDemoClock,
  canUseDemoClock,
  demoWallTime,
  getDemoClock,
  nextDemoBoundary,
  onDemoClockChange,
  setDemoClockBusy,
  setDemoClockTime,
  stopDemoClock,
} from 'services/clock/demoClock';

// constants and types
import { SCHEDULER_DEMO_ID, schedulerDemoDates } from 'pages/tournaments/schedulerDemoProfile';
import { COMPETITION_ENGINE, DEMO_CLOCK_PANEL, SCHEDULING_TAB } from 'constants/tmxConstants';
import { SCHEDULE_PROFILE_ROUNDS, SCHEDULE_PROFILE_GRID } from 'constants/mutationConstants';

import './demoClockPanel.css';

const ARIA_LABEL = 'aria-label';

let disposePanel: (() => void) | undefined;

function button(label: string, action: () => void): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.addEventListener('click', action);
  return element;
}

function installDrag(panel: HTMLElement, handle: HTMLElement): () => void {
  const move = (event: PointerEvent) => {
    if (!origin) return;
    panel.style.left = `${Math.max(0, Math.min(innerWidth - panel.offsetWidth, origin.left + event.clientX - origin.x))}px`;
    panel.style.top = `${Math.max(0, Math.min(innerHeight - 40, origin.top + event.clientY - origin.y))}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  };
  let origin: { x: number; y: number; left: number; top: number } | undefined;
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
    const rect = panel.getBoundingClientRect();
    origin = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    handle.setPointerCapture(event.pointerId);
  };
  const up = () => {
    origin = undefined;
  };
  handle.addEventListener('pointerdown', down);
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', up);
  handle.addEventListener('lostpointercapture', up);
  return () => {
    handle.removeEventListener('pointerdown', down);
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', up);
    handle.removeEventListener('lostpointercapture', up);
  };
}

/** One panel for one local fixture; closing or leaving releases both factory clocks. */
export function openDemoClockPanel(): void {
  if (!canUseDemoClock()) return;
  if (disposePanel) {
    document.getElementById(DEMO_CLOCK_PANEL)?.focus();
    return;
  }
  const record = tournamentEngine.getTournament().tournamentRecord;
  const zone = venueTimeZone() ?? '';
  if (!record?.startDate || !zone) return;
  const dates = schedulerDemoDates(record.startDate);
  const initial = demoWallTime(dates[0], '09:55', zone);
  if (!getDemoClock() && (initial === undefined || !setDemoClockTime(initial))) return;

  const panel = document.createElement('section');
  panel.id = DEMO_CLOCK_PANEL;
  panel.className = 'tmx-demo-clock';
  panel.tabIndex = -1;
  panel.setAttribute(ARIA_LABEL, t('demoClock.title'));
  const header = document.createElement('header');
  const title = document.createElement('strong');
  const body = document.createElement('div');
  body.className = 'tmx-demo-clock-body';
  const collapse = button(t('demoClock.collapse'), () => {
    body.hidden = !body.hidden;
    collapse.textContent = t(body.hidden ? 'demoClock.expand' : 'demoClock.collapse');
    collapse.setAttribute('aria-expanded', String(!body.hidden));
  });
  collapse.setAttribute('aria-expanded', 'true');
  header.append(title, collapse, button(t('demoClock.exit'), stopDemoClock));
  const clock = document.createElement('output');
  clock.setAttribute(ARIA_LABEL, t('demoClock.time'));
  const timezone = document.createElement('small');
  timezone.textContent = zone;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');

  const date = document.createElement('input');
  date.type = 'date';
  date.setAttribute(ARIA_LABEL, t('demoClock.date'));
  const time = document.createElement('input');
  time.type = 'time';
  time.setAttribute(ARIA_LABEL, t('demoClock.setTime'));
  const error = () => {
    status.textContent = t('demoClock.forwardOnly');
  };
  const set = button(t('demoClock.set'), () => {
    const at = demoWallTime(date.value, time.value, zone);
    if (at === undefined || !setDemoClockTime(at)) error();
  });
  const fields = document.createElement('div');
  fields.className = 'tmx-demo-clock-row';
  fields.append(date, time, set);
  const steps = document.createElement('div');
  steps.className = 'tmx-demo-clock-row';
  for (const minutes of [1, 5, 15])
    steps.append(
      button(t('demoClock.step', { minutes }), () => {
        if (!advanceDemoClock(minutes)) error();
      }),
    );

  const boundary = button('', () => {
    const next = readBoundary();
    if (next && !setDemoClockTime(next.at)) error();
  });
  function readBoundary() {
    const now = getDemoClock()?.nowMs;
    return now === undefined
      ? undefined
      : nextDemoBoundary(
          now,
          tournamentEngine.allTournamentMatchUps().matchUps ?? [],
          tournamentEngine.getVenuesAndCourts().venues ?? [],
          zone,
        );
  }

  const scenes = document.createElement('div');
  scenes.className = 'tmx-demo-clock-scenes';
  for (const [day, scheduleDate] of dates.entries()) {
    const scene = document.createElement('div');
    const heading = document.createElement('strong');
    heading.textContent = t(`demoClock.days.${day}.title`);
    const description = document.createElement('p');
    description.textContent = t(`demoClock.days.${day}.description`);
    const open = button(t('demoClock.openDay'), () => {
      if (getDemoClock()?.busy) return;
      const at = demoWallTime(scheduleDate, '09:55', zone);
      if (at !== undefined && at >= (getDemoClock()?.nowMs ?? 0)) setDemoClockTime(at);
      context.router?.navigate(`/tournament/${SCHEDULER_DEMO_ID}/${SCHEDULING_TAB}/${scheduleDate}/profile`);
    });
    scene.append(heading, description, open);
    // These use the same mutation path as Apply Times / Apply Grid, scoped to ONE day.
    if (day !== 1) scene.append(button(t('demoClock.garman'), () => void runScheduler(day, SCHEDULE_PROFILE_ROUNDS)));
    if (day !== 0) scene.append(button(t('demoClock.pro'), () => void runScheduler(day, SCHEDULE_PROFILE_GRID)));
    scenes.append(scene);
  }

  async function runScheduler(day: number, method: typeof SCHEDULE_PROFILE_ROUNDS | typeof SCHEDULE_PROFILE_GRID) {
    if (!canUseDemoClock() || getDemoClock()?.busy) return;
    if (hasUnsavedGridChanges() || hasUnsavedChanges() || isAvailabilityDirty()) {
      status.textContent = t('demoClock.saveFirst');
      return;
    }
    setDemoClockBusy(true);
    try {
      await mutationRequest({
        engine: COMPETITION_ENGINE,
        methods: [{ method, params: { scheduleDates: [dates[day]] } }],
        callback: (result) => {
          if (!getDemoClock() || !canUseDemoClock()) return;
          status.textContent = t(result?.error ? 'demoClock.failed' : 'demoClock.applied');
        },
      });
    } catch (err) {
      console.error('[demoClock] scheduler failed', err);
      status.textContent = t('demoClock.failed');
    } finally {
      setDemoClockBusy(false);
    }
  }

  const hint = document.createElement('p');
  hint.textContent = t('demoClock.hint');
  body.append(clock, timezone, fields, steps, boundary, scenes, hint, status);
  panel.append(header, body);
  document.body.append(panel);
  const removeDrag = installDrag(panel, header);
  function refresh() {
    const state = getDemoClock();
    if (!state) {
      disposePanel?.();
      return;
    }
    title.textContent = `${t('demoClock.title')} · ${venueClock(state.nowMs, zone)}`;
    clock.textContent = `${venueCalendarDate(state.nowMs, zone)} ${venueClock(state.nowMs, zone)} · ${t('demoClock.paused')}`;
    if (document.activeElement !== date) date.value = venueCalendarDate(state.nowMs, zone);
    if (document.activeElement !== time) time.value = venueClock(state.nowMs, zone);
    for (const control of body.querySelectorAll('button, input'))
      (control as HTMLButtonElement | HTMLInputElement).disabled = state.busy;
    const next = readBoundary();
    boundary.disabled = state.busy || !next;
    boundary.textContent = next
      ? t('demoClock.boundary', {
          kind: t(`demoClock.boundaries.${next.kind}`),
          time: `${venueCalendarDate(next.at, zone)} ${venueClock(next.at, zone)}`,
        })
      : t('demoClock.noBoundary');
  }
  const offClock = onDemoClockChange(refresh);
  const offMutation = onMutationApplied(refresh);
  disposePanel = () => {
    offClock();
    offMutation();
    removeDrag();
    panel.remove();
    disposePanel = undefined;
  };
  refresh();
  panel.focus();
}
