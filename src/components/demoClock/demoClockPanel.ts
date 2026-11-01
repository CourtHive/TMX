import { clearDemoOverlay, getDemoOverlay, isDemoActive, setDemoOverlay } from 'services/demoMode/demoState';
import { schedulerPeriodLength, withPeriodLength } from 'services/schedulePreferences/schedulingPeriodLength';
import { hasUnsavedChanges, isAvailabilityDirty } from 'services/schedulingWorkspace/queueService';
import { venueCalendarDate, venueClock, venueTimeZone } from 'functions/venueTimeFrame';
import { hasUnsavedGridChanges } from 'pages/tournament/tabs/scheduleViews/gridView';
import { schedulerDemoDates } from 'pages/tournaments/schedulerDemoProfile';
import { renderDemoAffordance } from 'services/demoMode/demoAffordance';
import { onMutationApplied } from 'services/mutation/mutationObservers';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import { mountDemoClock } from './demoClockDock';
import { context } from 'services/context';
import { t } from 'i18n';
import {
  advanceDemoClock,
  canUseDemoClock,
  demoClockResumeAt,
  demoTournamentStartDate,
  isDemoClockEligible,
  demoWallTime,
  getDemoClock,
  nextDemoBoundary,
  onDemoClockChange,
  setDemoClockBusy,
  setDemoClockTime,
  stopDemoClock,
} from 'services/clock/demoClock';
import {
  exportDemoWalkthrough,
  getWalkthroughStatus,
  onWalkthroughChange,
  startDemoWalkthrough,
  stopDemoWalkthrough,
} from 'services/clock/demoWalkthrough';

// constants and types
import { COMPETITION_ENGINE, DEMO_CLOCK_PANEL, SCHEDULING_TAB } from 'constants/tmxConstants';
import { SCHEDULE_PROFILE_ROUNDS, SCHEDULE_PROFILE_GRID } from 'constants/mutationConstants';
import type { DemoClockMode } from 'services/clock/demoClock';

import './demoClockPanel.css';

const CLOCK_ACTIVE_ATTRIBUTE = 'tmxDemoClock';

const ARIA_LABEL = 'aria-label';

let disposePanel: (() => void) | undefined;

function button(label: string, action: () => void): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.addEventListener('click', action);
  return element;
}

/** A centered page-bottom clock; details open only when requested. */
export function openDemoClockPanel(mode?: DemoClockMode): void {
  if (!isDemoClockEligible()) return;
  if (disposePanel) {
    if (mode) setDemoClockTime(getDemoClock()!.nowMs, mode);
    document.getElementById(DEMO_CLOCK_PANEL)?.focus();
    return;
  }
  // Everything that can refuse is checked BEFORE demo mode is entered, so a refusal never leaves the demo badge and
  // tint on with no clock.
  const tournamentId = tournamentEngine.getTournamentId();
  const startDate = demoTournamentStartDate();
  const zone = venueTimeZone() ?? '';
  const selectedMode = mode ?? 'script';
  const dates = startDate ? schedulerDemoDates(startDate) : [];
  // The clock always starts on the tournament's first day (the demo is generated to start today), whichever schedule
  // date the page happens to show: it only moves forward, so starting on a later day would strand the earlier ones.
  const firstDate = dates[0] ?? startDate;
  // Reopened after Exit or a route change, it resumes where it stopped: the record holds stamps up to there.
  const firstStart =
    firstDate && zone ? demoWallTime(firstDate, selectedMode === 'script' ? '09:55' : '08:00', zone) : undefined;
  const initial = firstStart === undefined ? undefined : demoClockResumeAt(firstStart);
  if (!getDemoClock() && initial === undefined) {
    tmxToast({ message: t('demoClock.cannotStart'), intent: 'is-warning' });
    return;
  }
  // Opening clock control explicitly enters demo mode without granting permissions. That posture is transient: it is
  // not persisted across a reload (the clock is not), and Exit removes it. A posture the operator chose is left alone.
  const enteredDemo = !isDemoActive();
  if (enteredDemo) {
    setDemoOverlay({ v: 1, preset: 'custom', permissions: {}, transient: true });
    renderDemoAffordance();
  }
  if (!getDemoClock() && !setDemoClockTime(initial!, selectedMode)) {
    if (enteredDemo) {
      clearDemoOverlay();
      renderDemoAffordance();
    }
    tmxToast({ message: t('demoClock.cannotStart'), intent: 'is-warning' });
    return;
  }

  const panel = document.createElement('section');
  panel.id = DEMO_CLOCK_PANEL;
  panel.className = 'tmx-demo-clock';
  panel.tabIndex = -1;
  panel.setAttribute(ARIA_LABEL, t('demoClock.title'));
  const header = document.createElement('div');
  header.className = 'tmx-demo-clock-toolbar';
  const body = document.createElement('div');
  body.className = 'tmx-demo-clock-body';
  body.hidden = true;
  const collapse = button(t('demoClock.expand'), () => {
    body.hidden = !body.hidden;
    collapse.textContent = t(body.hidden ? 'demoClock.expand' : 'demoClock.collapse');
    collapse.setAttribute('aria-expanded', String(!body.hidden));
  });
  collapse.setAttribute('aria-expanded', 'false');
  const exit = button(t('demoClock.exit'), () => {
    stopDemoClock();
    if (getDemoOverlay()?.transient) clearDemoOverlay();
    renderDemoAffordance();
  });
  const clock = document.createElement('output');
  clock.setAttribute(ARIA_LABEL, t('demoClock.time'));
  header.append(clock);
  clock.title = zone;
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
  steps.className = 'tmx-demo-clock-steps';
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
    heading.textContent = t(`demoClock.days.day${day + 1}.title`);
    const description = document.createElement('p');
    description.textContent = t(`demoClock.days.day${day + 1}.description`);
    const open = button(t('demoClock.openDay'), () => {
      if (getDemoClock()?.busy) return;
      const at = demoWallTime(scheduleDate, '09:55', zone);
      if (at !== undefined && at >= (getDemoClock()?.nowMs ?? 0)) setDemoClockTime(at);
      context.router?.navigate(`/tournament/${tournamentId}/${SCHEDULING_TAB}/${scheduleDate}/profile`);
    });
    scene.append(heading, description, open);
    // These use the same mutation path as Apply Times / Apply Grid, scoped to ONE day.
    if (day !== 1) scene.append(button(t('demoClock.garman'), () => runScheduler(day, SCHEDULE_PROFILE_ROUNDS)));
    if (day !== 0) scene.append(button(t('demoClock.pro'), () => runScheduler(day, SCHEDULE_PROFILE_GRID)));
    scenes.append(scene);
  }

  /** the timed scheduler takes the tournament's period length; the grid assigns no times */
  function schedulerParams(method: string, scheduleDates: string[]) {
    if (method !== SCHEDULE_PROFILE_ROUNDS) return { scheduleDates };
    const tournamentRecord = tournamentEngine.getTournament?.()?.tournamentRecord;
    return withPeriodLength({ scheduleDates }, schedulerPeriodLength(tournamentRecord));
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
        methods: [{ method, params: schedulerParams(method, [dates[day]]) }],
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

  const modeLabel = document.createElement('label');
  modeLabel.textContent = t('demoClock.mode');
  const modeSelect = document.createElement('select');
  modeSelect.setAttribute(ARIA_LABEL, t('demoClock.mode'));
  const modes: DemoClockMode[] = ['clock', 'script'];
  for (const value of modes) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = t(`demoClock.modes.${value}`);
    modeSelect.append(option);
  }
  modeSelect.addEventListener('change', () =>
    setDemoClockTime(getDemoClock()!.nowMs, modeSelect.value as DemoClockMode),
  );
  modeLabel.append(modeSelect);

  const captureStatus = document.createElement('p');
  captureStatus.setAttribute('aria-live', 'polite');
  const captureButton = button('', () => {
    if (getWalkthroughStatus().recording) stopDemoWalkthrough();
    else if (hasUnsavedGridChanges() || hasUnsavedChanges() || isAvailabilityDirty())
      status.textContent = t('demoClock.saveFirst');
    else if (!startDemoWalkthrough()) status.textContent = t('demoClock.captureFailed');
  });
  const exportButton = button(t('demoClock.exportCapture'), () => {
    exportDemoWalkthrough().catch((error) => console.error('[demoClock] export failed', error));
  });
  const captureControls = document.createElement('div');
  captureControls.className = 'tmx-demo-clock-row';
  captureControls.append(captureButton, exportButton);
  function refreshCapture() {
    const capture = getWalkthroughStatus();
    captureButton.textContent = t(capture.recording ? 'demoClock.stopCapture' : 'demoClock.startCapture');
    exportButton.disabled = !capture.available;
    let key = 'demoClock.captureReady';
    if (capture.recording) key = 'demoClock.capturing';
    if (capture.stopReason === 'limit') key = 'demoClock.captureLimit';
    captureStatus.textContent = t(key, { count: capture.steps });
  }
  const offCapture = onWalkthroughChange(refreshCapture);
  refreshCapture();

  const hint = document.createElement('p');
  hint.textContent = t('demoClock.hint');
  header.append(collapse, exit);
  body.append(timezone, modeLabel, fields, steps, boundary, scenes, hint, captureControls, captureStatus, status);
  panel.append(header, body);
  document.documentElement.dataset[CLOCK_ACTIVE_ATTRIBUTE] = 'true';
  const unmount = mountDemoClock(panel);
  function refresh() {
    const state = getDemoClock();
    if (!state) {
      disposePanel?.();
      return;
    }
    clock.textContent = `${t('demoClock.shortLabel')} · ${venueClock(state.nowMs, zone)}`;
    clock.title = `${venueCalendarDate(state.nowMs, zone)} · ${zone} · ${t('demoClock.modes.' + state.mode)} · ${t('demoClock.paused')}`;
    scenes.hidden = state.mode !== 'script';
    hint.textContent = t(state.mode === 'script' ? 'demoClock.hint' : 'demoClock.freeHint');
    modeSelect.value = state.mode;
    if (document.activeElement !== date) date.value = venueCalendarDate(state.nowMs, zone);
    if (document.activeElement !== time) time.value = venueClock(state.nowMs, zone);
    for (const control of panel.querySelectorAll('button, input, select'))
      (control as HTMLButtonElement | HTMLInputElement).disabled = state.busy;
    refreshCapture();
    collapse.disabled = false;
    exit.disabled = false;
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
    offCapture();
    unmount();
    delete document.documentElement.dataset[CLOCK_ACTIVE_ATTRIBUTE];
    disposePanel = undefined;
  };
  refresh();
  panel.focus();
}
