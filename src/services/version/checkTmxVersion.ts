/**
 * Detect when a newer TMX has been deployed than the one this tab is running.
 *
 * `dist/version.json` is emitted at build time by the Vite plugin in
 * `vite.config.ts`. We poll it on `visibilitychange→visible` and every
 * `POLL_INTERVAL_MS` while visible, comparing against the version baked into
 * this bundle. On a newer deploy, `promptRefresh` shows a sticky toast — the
 * same shared prompt the factory-mismatch check uses, so a scenario that trips
 * both surfaces one refresh toast, not two.
 */
import { fetchDeployedManifest } from 'services/version/deployedManifest';
import { version as bundledVersion } from 'config/version';
import { promptRefresh } from 'services/version/refreshPrompt';

const POLL_INTERVAL_MS = 15 * 60 * 1000;

let pollTimer: ReturnType<typeof setInterval> | undefined;
let initialized = false;

async function check(): Promise<void> {
  const { version: deployed } = await fetchDeployedManifest();
  if (!deployed || deployed === bundledVersion) return;

  stopPolling();
  promptRefresh(`New TMX version available (${deployed}). Refresh to update.`);
}

function startPolling(): void {
  if (pollTimer) return;
  pollTimer = setInterval(check, POLL_INTERVAL_MS);
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'visible') {
    void check();
    startPolling();
  } else {
    stopPolling();
  }
}

export function initTmxVersionCheck(): void {
  if (initialized) return;
  initialized = true;
  document.addEventListener('visibilitychange', onVisibilityChange);
  if (document.visibilityState === 'visible') {
    startPolling();
  }
}

export function destroyTmxVersionCheck(): void {
  document.removeEventListener('visibilitychange', onVisibilityChange);
  stopPolling();
  initialized = false;
}
