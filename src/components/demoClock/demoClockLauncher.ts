import { buildSchedulerDemoProfile, DEMO_COPY_SCRIPT } from 'pages/tournaments/schedulerDemoProfile';
import { hasUnsavedChanges, isAvailabilityDirty } from 'services/schedulingWorkspace/queueService';
import { exportDemoWalkthrough, getWalkthroughStatus } from 'services/clock/demoWalkthrough';
import { onTournamentContextChanged } from 'services/tournament/tournamentContextObservers';
import { isDemoClockEligible, isDemoClockSessionEligible } from 'services/clock/demoClock';
import { hasUnsavedGridChanges } from 'pages/tournament/tabs/scheduleViews/gridView';
import { saveTournamentRecord } from 'services/storage/saveTournamentRecord';
import { mocksEngine, tools } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import { openDemoClockPanel } from './demoClockPanel';
import { context } from 'services/context';
import { t } from 'i18n';

// constants and types
import type { DemoClockMode } from 'services/clock/demoClock';

function dirty(): boolean {
  return hasUnsavedChanges() || isAvailabilityDirty() || hasUnsavedGridChanges();
}

/** Save a demo record, load it through the normal route, and open the clock once it is the loaded tournament. */
async function installDemoRecord(tournamentRecord: any, mode: DemoClockMode): Promise<void> {
  const id = tournamentRecord.tournamentId;
  const location = globalThis.location.hash;
  await saveTournamentRecord({ tournamentRecord });
  if (!isDemoClockSessionEligible() || globalThis.location.hash !== location || dirty()) return;
  const timeout = setTimeout(() => off(), 10_000);
  const off = onTournamentContextChanged((tournamentId) => {
    clearTimeout(timeout);
    off();
    if (tournamentId === id)
      queueMicrotask(() => {
        if (isDemoClockSessionEligible()) openDemoClockPanel(mode);
      });
  });
  context.router?.navigate(`/tournament/${id}/scheduling`);
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
  await installDemoRecord(result.tournamentRecord, 'script');
}

/**
 * The open tournament, if free clock may run on a demo copy of it: anonymous session, a local tournament with no
 * provider, alone in the engine. The demo clock stamps simulated times into whatever it runs on, so it never runs on
 * the original.
 */
function copySource(): any {
  if (!isDemoClockSessionEligible()) return undefined;
  const record = tournamentEngine.getTournament().tournamentRecord;
  const alone = Object.keys(tournamentEngine.getState().tournamentRecords ?? {}).length === 1;
  return record?.tournamentId && !record.parentOrganisation?.organisationId && alone ? record : undefined;
}

async function openFreeClockOnCopy(): Promise<void> {
  const source = copySource();
  if (!source) return;
  if (dirty()) {
    tmxToast({ message: t('demoClock.saveFirst'), intent: 'is-warning' });
    return;
  }
  const copy = tools.makeDeepCopy(source, false, true);
  copy.tournamentId = `demo-copy-${tools.UUID()}`;
  copy.tournamentName = t('demoClock.copyName', { name: source.tournamentName ?? source.tournamentId });
  copy.extensions = [
    ...(copy.extensions ?? []).filter((extension: any) => extension.name !== 'demoScript'),
    { name: 'demoScript', value: DEMO_COPY_SCRIPT },
  ];
  await installDemoRecord(copy, 'clock');
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
  // A demo tournament runs the clock as it is; any other local tournament runs it on a demo copy.
  free.disabled = !isDemoClockEligible() && !copySource();
  free.addEventListener('click', () => {
    context.drawer.close();
    if (isDemoClockEligible()) {
      openDemoClockPanel('clock');
      return;
    }
    openFreeClockOnCopy().catch((error) => {
      console.error('[demoClock] copy failed', error);
      tmxToast({ message: t('demoClock.loadFailed'), intent: 'is-danger' });
    });
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
    download.addEventListener('click', () => {
      exportDemoWalkthrough().catch((error) => console.error('[demoClock] export failed', error));
    });
    root.append(download);
  }
  return root;
}
