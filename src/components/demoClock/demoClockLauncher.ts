import { hasUnsavedChanges, isAvailabilityDirty } from 'services/schedulingWorkspace/queueService';
import { exportDemoWalkthrough, getWalkthroughStatus } from 'services/clock/demoWalkthrough';
import { onTournamentContextChanged } from 'services/tournament/tournamentContextObservers';
import { isDemoClockEligible, isDemoClockSessionEligible } from 'services/clock/demoClock';
import { hasUnsavedGridChanges } from 'pages/tournament/tabs/scheduleViews/gridView';
import { buildSchedulerDemoProfile } from 'pages/tournaments/schedulerDemoProfile';
import { saveTournamentRecord } from 'services/storage/saveTournamentRecord';
import { mocksEngine, tools } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { openDemoClockPanel } from './demoClockPanel';
import { context } from 'services/context';
import { t } from 'i18n';

function dirty(): boolean {
  return hasUnsavedChanges() || isAvailabilityDirty() || hasUnsavedGridChanges();
}

async function loadGuidedDemo(): Promise<void> {
  if (!isDemoClockSessionEligible()) return;
  if (dirty()) {
    tmxToast({ message: t('demoClock.saveFirst'), intent: 'is-warning' });
    return;
  }
  const profile = buildSchedulerDemoProfile(new Date());
  if (!profile) return;
  const id = `scheduling-demo-${tools.UUID()}`;
  const result = mocksEngine.generateTournamentRecord({
    ...profile,
    tournamentAttributes: { ...profile.tournamentAttributes, tournamentId: id },
  } as any);
  if (result.error || !result.tournamentRecord) throw new Error('DEMO_GENERATION_FAILED');
  const location = globalThis.location.hash;
  await saveTournamentRecord({ tournamentRecord: result.tournamentRecord });
  if (!isDemoClockSessionEligible() || globalThis.location.hash !== location || dirty()) return;
  // Use the normal load/navigation path, and open the clock only after this fresh record is installed.
  const timeout = setTimeout(() => off(), 10_000);
  const off = onTournamentContextChanged((tournamentId) => {
    clearTimeout(timeout);
    off();
    if (tournamentId === id)
      queueMicrotask(() => {
        if (isDemoClockSessionEligible()) openDemoClockPanel('script');
      });
  });
  context.router?.navigate(`/tournament/${id}/scheduling`);
}

export function buildDemoClockLauncher(): HTMLElement {
  const root = document.createElement('div');
  root.hidden = !isDemoClockSessionEligible();
  const hint = document.createElement('p');
  hint.textContent = t('demoClock.launchHint');
  const free = document.createElement('button');
  free.type = 'button';
  free.className = 'button';
  free.textContent = t('demoClock.launch');
  free.disabled = !isDemoClockEligible();
  free.addEventListener('click', () => {
    context.drawer.close();
    openDemoClockPanel('clock');
  });
  const guided = document.createElement('button');
  guided.type = 'button';
  guided.className = 'button';
  guided.textContent = t('demoClock.loadScript');
  guided.addEventListener('click', async () => {
    guided.disabled = true;
    context.drawer.close();
    try {
      await loadGuidedDemo();
    } catch (error) {
      console.error('[demoClock] load failed', error);
      tmxToast({ message: t('demoClock.loadFailed'), intent: 'is-danger' });
    } finally {
      guided.disabled = false;
    }
  });
  root.append(hint, free, guided);
  if (getWalkthroughStatus().available) {
    const download = document.createElement('button');
    download.type = 'button';
    download.className = 'button';
    download.textContent = t('demoClock.exportCapture');
    download.addEventListener('click', () => void exportDemoWalkthrough());
    root.append(download);
  }
  return root;
}
