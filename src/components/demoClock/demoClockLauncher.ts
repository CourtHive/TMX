import { isDemoClockEligible } from 'services/clock/demoClock';
import { exportDemoWalkthrough, getWalkthroughStatus } from 'services/clock/demoWalkthrough';
import { enterTimeWarpAtChosenTime } from 'components/timeWarp/warpStartPrompt';
import { canEnterTimeWarp, enterTimeWarp } from 'services/timeWarp/timeWarp';
import { isTimeWarpActive } from 'services/timeWarp/warpState';
import { buildSchedulerDemoProfile } from 'pages/tournaments/schedulerDemoProfile';
import { mocksEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { openDemoClockPanel } from './demoClockPanel';
import { context } from 'services/context';
import { t } from 'i18n';

export function buildDemoClockLauncher(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'tmx-demo-launcher';
  const hint = document.createElement('p');
  hint.textContent = t('demoClock.launchHint');
  const free = document.createElement('button');
  free.type = 'button';
  free.className = 'button';
  free.textContent = t(isTimeWarpActive() ? 'demoClock.launch' : 'timeWarp.enter');
  free.addEventListener('click', () => {
    context.drawer.close();
    if (isTimeWarpActive()) openDemoClockPanel('clock');
    else void enterTimeWarpAtChosenTime();
  });
  const guided = document.createElement('button');
  guided.type = 'button';
  guided.className = 'button';
  guided.textContent = t('demoClock.loadScript');
  guided.disabled = isTimeWarpActive();
  guided.addEventListener('click', async () => {
    guided.disabled = true;
    context.drawer.close();
    try {
      const profile = buildSchedulerDemoProfile(new Date());
      if (!profile) return;
      const result = mocksEngine.generateTournamentRecord(profile as any);
      if (result.error || !result.tournamentRecord) throw new Error('DEMO_GENERATION_FAILED');
      await enterTimeWarp({ record: result.tournamentRecord, mode: 'script' });
    } catch (error) {
      console.error('[demoClock] load failed', error);
      tmxToast({ message: t('demoClock.loadFailed'), intent: 'is-danger' });
    } finally {
      guided.disabled = false;
    }
  });
  root.append(hint, ...(canEnterTimeWarp() || isTimeWarpActive() ? [free] : []), guided);
  // Older saved Scheduling Labs can still reopen their original clock; new guided sessions are disposable Warps.
  if (!isTimeWarpActive() && isDemoClockEligible()) {
    const reopen = document.createElement('button');
    reopen.type = 'button';
    reopen.className = 'button';
    reopen.textContent = t('demoClock.launch');
    reopen.addEventListener('click', () => {
      context.drawer.close();
      openDemoClockPanel('clock');
    });
    root.append(reopen);
  }
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
