/**
 * Detect when a newer TMX has been deployed than the one this tab is running.
 *
 * `dist/version.json` is emitted at build time by the Vite plugin in
 * `vite.config.ts`. We poll it on `visibilitychange→visible` and every
 * `POLL_INTERVAL_MS` while visible, comparing against the version baked
 * into this bundle. On mismatch, a sticky toast prompts the user to refresh.
 */
import { tmxToast } from 'services/notifications/tmxToast';
import { version as bundledVersion } from 'config/version';
import { debugConfig } from 'config/debugConfig';

const slog = (...args: any[]) => debugConfig.get().socketLog && console.log(...args);

const POLL_INTERVAL_MS = 15 * 60 * 1000;

let pollTimer: ReturnType<typeof setInterval> | undefined;
let warned = false;
let initialized = false;

async function fetchDeployedVersion(): Promise<string | undefined> {
  const url = `${import.meta.env.BASE_URL}version.json?t=${Date.now()}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      slog('[version] version.json returned', res.status);
      return undefined;
    }
    const body = await res.json();
    return typeof body?.version === 'string' ? body.version : undefined;
  } catch (err) {
    slog('[version] version.json fetch failed:', err);
    return undefined;
  }
}

async function check(): Promise<void> {
  if (warned) return;
  const deployed = await fetchDeployedVersion();
  if (!deployed || deployed === bundledVersion) return;

  warned = true;
  stopPolling();

  const message = `New TMX version available (${deployed}). Refresh to update.`;
  console.warn('[version]', message, '— bundled:', bundledVersion);
  tmxToast({
    intent: 'is-info',
    duration: 0,
    dismissible: true,
    pauseOnHover: true,
    message,
    action: { text: 'Refresh', onClick: () => globalThis.location.reload() },
  });
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
  warned = false;
  initialized = false;
}
