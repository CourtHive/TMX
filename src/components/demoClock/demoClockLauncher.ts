import { hasUnsavedChanges, isAvailabilityDirty } from 'services/schedulingWorkspace/queueService';
import { GUIDED_DEMO_ID_PREFIX, staleGuidedDemoIds } from 'services/clock/schedulingDemoScript';
import { exportDemoWalkthrough, getWalkthroughStatus } from 'services/clock/demoWalkthrough';
import { onTournamentContextChanged } from 'services/tournament/tournamentContextObservers';
import { isDemoClockEligible, isDemoClockSessionEligible } from 'services/clock/demoClock';
import { hasUnsavedGridChanges } from 'pages/tournament/tabs/scheduleViews/gridView';
import { buildSchedulerDemoProfile } from 'pages/tournaments/schedulerDemoProfile';
import { saveTournamentRecord } from 'services/storage/saveTournamentRecord';
import { mocksEngine, tools } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { openDemoClockPanel } from './demoClockPanel';
import { tmx2db } from 'services/storage/tmx2db';
import { context } from 'services/context';
import { t } from 'i18n';

// constants and types
import type { DemoClockMode } from 'services/clock/demoClock';

function dirty(): boolean {
  return hasUnsavedChanges() || isAvailabilityDirty() || hasUnsavedGridChanges();
}

function notOpened(): void {
  tmxToast({ message: t('demoClock.notOpened'), intent: 'is-warning' });
}

/** Remove the earlier guided-demo copies, once the new one is the loaded tournament, so they do not pile up. */
async function removeStaleGuidedDemos(keepId: string): Promise<void> {
  try {
    for (const id of staleGuidedDemoIds(await tmx2db.findTournamentIds(), keepId)) await tmx2db.deleteTournament(id);
  } catch (error) {
    console.error('[demoClock] stale demo cleanup failed', error);
  }
}

/** Save a demo record, load it through the normal route, and open the clock once it is the loaded tournament. */
async function installDemoRecord(tournamentRecord: any, mode: DemoClockMode): Promise<void> {
  const id = tournamentRecord.tournamentId;
  const location = globalThis.location.hash;
  await saveTournamentRecord({ tournamentRecord });
  // Saved, but the operator moved on (navigated, signed in, or began editing) while it saved: say where it went.
  if (!isDemoClockSessionEligible() || globalThis.location.hash !== location || dirty()) return notOpened();
  const timeout = setTimeout(() => {
    off();
    notOpened();
  }, 10_000);
  const off = onTournamentContextChanged((tournamentId) => {
    clearTimeout(timeout);
    off();
    if (tournamentId !== id) return notOpened();
    if (id.startsWith(GUIDED_DEMO_ID_PREFIX)) void removeStaleGuidedDemos(id);
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
  const id = `${GUIDED_DEMO_ID_PREFIX}${tools.UUID()}`;
  const result = mocksEngine.generateTournamentRecord({
    ...profile,
    tournamentAttributes: { ...profile.tournamentAttributes, tournamentId: id },
  } as any);
  if (result.error || !result.tournamentRecord) throw new Error('DEMO_GENERATION_FAILED');
  await installDemoRecord(result.tournamentRecord, 'script');
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
  // The clock runs only on a Scheduling Lab, so this is offered only while one is open (to reopen its clock). It is
  // left out rather than `hidden`: the `button` class sets display, which overrides the attribute.
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
  root.append(hint, ...(isDemoClockEligible() ? [free] : []), guided);
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
