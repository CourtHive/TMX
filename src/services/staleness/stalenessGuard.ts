/**
 * Staleness guard — detects when local tournament data may be out of sync
 * with the server after the device sleeps or the tab goes to background.
 *
 * Mechanism:
 * 1. An inactivity timer (default 5 min) resets on any mutation or navigation.
 * 2. When the page becomes visible again (Page Visibility API), if the timer
 *    has expired OR a socket disconnect was detected, a lightweight server
 *    check compares `updatedAt` timestamps.
 * 3. If the server is ahead, a blocking overlay forces the TD to refresh
 *    before any further mutations can be submitted.
 */
import { hadDisconnect, clearDisconnectFlag, joinTournamentRoom } from 'services/messaging/socketIo';
import { saveTournamentRecord } from 'services/storage/saveTournamentRecord';
import { getLoginState } from 'services/authentication/loginState';
import { requestTournament } from 'services/apis/servicesApi';
import { tournamentEngine } from 'tods-competition-factory';
import { debugConfig } from 'config/debugConfig';
import { context } from 'services/context';

// constants
import { SYNC_INDICATOR } from 'constants/tmxConstants';

const slog = (...args: any[]) => debugConfig.get().socketLog && console.log(...args);

// ── Configuration ──
// Default: 5 minutes. Override from browser console: dev.stalenessTimeout = 30 (seconds)

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

function getTimeoutMs(): number {
  const override = (globalThis as any).dev?.stalenessTimeout;
  return typeof override === 'number' && override > 0 ? override * 1000 : DEFAULT_TIMEOUT_MS;
}

function isDebugMode(): boolean {
  return (globalThis as any).dev?.stalenessTimeout > 0;
}

// ── State ──

let inactivityTimer: ReturnType<typeof setTimeout> | undefined;
let countdownInterval: ReturnType<typeof setInterval> | undefined;
let timerExpired = false;
let overlayVisible = false;
let checking = false;
let initialized = false;

// ── Public API ──

/** Returns true when the stale-data overlay is showing — mutations must be blocked. */
export function isStale(): boolean {
  return overlayVisible;
}

/** Reset the inactivity timer. No-op in local-only mode (not logged in). */
export function resetActivityTimer(): void {
  if (!getLoginState()) return;

  timerExpired = false;
  if (inactivityTimer) clearTimeout(inactivityTimer);
  if (countdownInterval) clearInterval(countdownInterval);

  const timeoutMs = getTimeoutMs();
  const debug = isDebugMode();

  if (debug) {
    let remaining = Math.ceil(timeoutMs / 1000);
    console.log('[staleness] timer reset — %ds until stale', remaining);
    countdownInterval = setInterval(() => {
      remaining--;
      if (remaining > 0) {
        console.log('[staleness] %ds remaining', remaining);
      } else {
        clearInterval(countdownInterval);
      }
    }, 1000);
  }

  inactivityTimer = setTimeout(() => {
    timerExpired = true;
    if (debug) console.log('[staleness] timer expired — checking server');
    slog('[staleness] inactivity timer expired');

    const { tournamentRecord } = tournamentEngine.getTournament();
    if (tournamentRecord?.tournamentId) {
      checkAndShowOverlay(tournamentRecord.tournamentId);
    }
  }, timeoutMs);
}

/** Initialize the guard. Call once at startup. */
export function initStalenessGuard(): void {
  if (initialized) return;
  initialized = true;

  document.addEventListener('visibilitychange', onVisibilityChange);
  resetActivityTimer();
  slog('[staleness] guard initialized');
}

/** Tear down (for testing or cleanup). */
export function destroyStalenessGuard(): void {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  if (countdownInterval) clearInterval(countdownInterval);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  dismissOverlay();
  initialized = false;
}

// ── Visibility handler ──

function onVisibilityChange(): void {
  if (document.visibilityState !== 'visible') return;

  const debug = isDebugMode();
  const wasExpired = timerExpired;
  const wasDisconnected = hadDisconnect();

  if (debug) console.log('[staleness] page visible — wasExpired=%s, wasDisconnected=%s', wasExpired, wasDisconnected);

  // Reset the timer for the next cycle
  resetActivityTimer();

  // Only check if we have reason to believe data may be stale
  if (!wasExpired && !wasDisconnected) {
    if (debug) console.log('[staleness] no staleness signals — skipping check');
    return;
  }

  // Must be logged in and have a tournament loaded
  if (!getLoginState()) {
    if (debug) console.log('[staleness] not logged in — skipping check');
    return;
  }
  const { tournamentRecord } = tournamentEngine.getTournament();
  if (!tournamentRecord?.tournamentId) {
    if (debug) console.log('[staleness] no tournament loaded — skipping check');
    return;
  }

  if (debug) console.log('[staleness] checking server for:', tournamentRecord.tournamentId);
  checkAndShowOverlay(tournamentRecord.tournamentId);
}

// ── Core check logic ──

async function checkAndShowOverlay(tournamentId: string): Promise<void> {
  if (checking || overlayVisible) return;
  checking = true;

  const debug = isDebugMode();

  try {
    const result = await requestTournament({ tournamentId });
    const serverRecord = result?.data?.tournamentRecords?.[tournamentId];

    if (!serverRecord) {
      if (debug) console.log('[staleness] server returned no record — skipping');
      return;
    }

    const localRecord = tournamentEngine.getTournament()?.tournamentRecord;
    const serverUpdated = serverRecord.updatedAt ? new Date(serverRecord.updatedAt).getTime() : 0;
    const localUpdated = localRecord?.updatedAt ? new Date(localRecord.updatedAt).getTime() : 0;

    if (debug)
      console.log(
        '[staleness] server=%s local=%s stale=%s',
        serverRecord.updatedAt,
        localRecord?.updatedAt,
        serverUpdated > localUpdated,
      );

    if (serverUpdated > localUpdated) {
      showOverlay(tournamentId, serverRecord);
    } else {
      if (debug) console.log('[staleness] data is current — no overlay needed');
      if (hadDisconnect()) clearDisconnectFlag();
    }
  } catch (err) {
    console.warn('[staleness] check failed:', err);
  } finally {
    checking = false;
  }
}

/**
 * Force the staleness overlay for testing.
 * Call from console: dev.forceStalenessOverlay()
 */
export function forceStalenessOverlay(): void {
  const { tournamentRecord } = tournamentEngine.getTournament();
  if (!tournamentRecord?.tournamentId) {
    console.warn('[staleness] no tournament loaded');
    return;
  }
  showOverlay(tournamentRecord.tournamentId, tournamentRecord);
}

// ── Overlay ──

function showOverlay(tournamentId: string, serverRecord: any): void {
  overlayVisible = true;

  const overlay = document.createElement('div');
  overlay.id = 'staleness-overlay';
  overlay.style.cssText = [
    'position: fixed',
    'inset: 0',
    'z-index: 99999',
    'display: flex',
    'flex-direction: column',
    'align-items: center',
    'justify-content: center',
    'background: rgba(0, 0, 0, 0.6)',
    'backdrop-filter: blur(2px)',
  ].join('; ');

  const card = document.createElement('div');
  card.style.cssText = [
    'background: var(--chc-bg-primary, #fff)',
    'color: var(--chc-text-primary, #333)',
    'border-radius: 12px',
    'padding: 2rem 2.5rem',
    'max-width: 400px',
    'text-align: center',
    'box-shadow: 0 8px 32px rgba(0,0,0,0.3)',
  ].join('; ');

  const icon = document.createElement('div');
  icon.innerHTML =
    '<i class="fa-solid fa-rotate" style="font-size: 2rem; color: var(--tmx-accent-blue, #3273dc);"></i>';
  icon.style.marginBottom = '1rem';

  const title = document.createElement('h3');
  title.textContent = 'Tournament data has changed';
  title.style.cssText = 'margin: 0 0 0.5rem; font-size: 1.1rem;';

  const message = document.createElement('p');
  message.textContent = 'Changes were made while this session was inactive. Please refresh to continue.';
  message.style.cssText = 'margin: 0 0 1.5rem; font-size: 0.9rem; color: var(--chc-text-secondary, #666);';

  const button = document.createElement('button');
  button.className = 'button is-primary';
  button.textContent = 'Refresh';
  button.style.cssText = 'min-width: 140px;';
  button.onclick = () => applyRefresh(tournamentId, serverRecord);

  card.appendChild(icon);
  card.appendChild(title);
  card.appendChild(message);
  card.appendChild(button);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function applyRefresh(tournamentId: string, serverRecord: any): void {
  tournamentEngine.setState(serverRecord);
  saveTournamentRecord();

  // Re-join the tournament room in case the socket reconnected
  joinTournamentRoom(tournamentId);
  if (hadDisconnect()) clearDisconnectFlag();

  // Refresh the active table if one exists
  if (context.refreshActiveTable) {
    context.refreshActiveTable();
  } else {
    const el = document.getElementById(SYNC_INDICATOR);
    if (el) {
      el.style.display = '';
      el.classList.add('sync-indicator--active');
    }
  }

  dismissOverlay();
}

function dismissOverlay(): void {
  overlayVisible = false;
  const el = document.getElementById('staleness-overlay');
  if (el) el.remove();
}
