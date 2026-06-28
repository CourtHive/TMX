/**
 * Staleness guard — detects when local tournament data may be behind the server
 * (device sleep, tab background, socket drop, or a silent broadcast gap) and
 * surfaces the sync/refresh icon so the director can pull the fresh record on
 * demand.
 *
 * Detection is always a lightweight `updatedAt` probe — it never pulls the full
 * record. Triggers:
 *   1. An inactivity timer (default 5 min) that resets on any mutation/navigation.
 *   2. Page becomes visible again, if the timer expired or a disconnect occurred.
 *   3. Socket reconnect.
 *   4. A periodic poll while the tab is visible.
 * When the server is ahead, the sync icon is flagged stale; clicking it pulls
 * the full record. While stale, `isStale()` is true and mutations are blocked
 * (see mutationRequest) so a director can't act on stale data.
 */
import { hadDisconnect, clearDisconnectFlag, onSocketReconnect } from 'services/messaging/socketIo';
import { markStaleNeedsRefresh, isSyncStale } from 'services/messaging/remoteMutations';
import { requestTournamentUpdatedAt } from 'services/apis/servicesApi';
import { getLoginState } from 'services/authentication/loginState';
import { tournamentEngine } from 'services/factory/engine';
import { debugConfig } from 'config/debugConfig';

const slog = (...args: any[]) => debugConfig.get().socketLog && console.log(...args);

// ── Configuration ──
// Default: 5 minutes. Override from browser console: dev.stalenessTimeout = 30 (seconds)

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

// Periodic "am I behind the server?" poll. Runs only while the tab is visible
// and logged in — a safety net for mutations missed during a silent socket drop
// where no `disconnect`/`visibilitychange` event fired. Override from console:
// dev.stalenessPollInterval = 20 (seconds); 0 disables polling.
const DEFAULT_POLL_MS = 45 * 1000;

function getTimeoutMs(): number {
  const override = (globalThis as any).dev?.stalenessTimeout;
  return typeof override === 'number' && override > 0 ? override * 1000 : DEFAULT_TIMEOUT_MS;
}

function getPollMs(): number {
  const override = (globalThis as any).dev?.stalenessPollInterval;
  if (override === 0) return 0;
  return typeof override === 'number' && override > 0 ? override * 1000 : DEFAULT_POLL_MS;
}

function isDebugMode(): boolean {
  return (globalThis as any).dev?.stalenessTimeout > 0;
}

// ── State ──

let inactivityTimer: ReturnType<typeof setTimeout> | undefined;
let countdownInterval: ReturnType<typeof setInterval> | undefined;
let pollInterval: ReturnType<typeof setInterval> | undefined;
let timerExpired = false;
let checking = false;
let initialized = false;

// ── Public API ──

/** Returns true when the local copy is known to be behind the server — the sync
 * icon is in stale mode and mutations must be blocked until the user refreshes. */
export function isStale(): boolean {
  return isSyncStale();
}

/** Reset the inactivity timer. No-op in local-only mode (not logged in),
 * but always clears any previously-running timer first so logout / session
 * expiry stops the cycle (e.g. when called from `logOut`). */
export function resetActivityTimer(): void {
  timerExpired = false;
  if (inactivityTimer) clearTimeout(inactivityTimer);
  if (countdownInterval) clearInterval(countdownInterval);
  if (!getLoginState()) return;

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

    // Re-check login state at fire time — the timer may have been scheduled
    // while logged in but the user has since logged out / session expired.
    // Local-only tournaments are never on the server, so this check would
    // toast a "Missing tournamentRecord" error for no useful reason.
    if (!getLoginState()) {
      if (debug) console.log('[staleness] no longer logged in — skipping check');
      return;
    }
    triggerStalenessCheck();
  }, timeoutMs);
}

/** Check now whether local data is behind the server. Uses the lightweight
 * `updatedAt` probe (never pulls the full record) and, if behind, surfaces the
 * refresh icon — clicking it pulls the fresh record on demand. Safe to call any
 * time; no-ops when logged out, with no tournament loaded, or when a check is
 * already in flight. Used by the inactivity timer, visibility handler, reconnect
 * hook, and periodic poll. */
export function triggerStalenessCheck(): void {
  if (!getLoginState()) return;
  const { tournamentRecord } = tournamentEngine.getTournament();
  if (tournamentRecord?.tournamentId) void probeStaleness(tournamentRecord.tournamentId);
}

/** Lightweight staleness probe — fetches only the server `updatedAt` and, when
 * the server is ahead, flags the sync indicator stale (no full-record pull). */
async function probeStaleness(tournamentId: string): Promise<void> {
  if (checking || isSyncStale()) return;
  checking = true;

  const debug = isDebugMode();
  try {
    const result: any = await requestTournamentUpdatedAt({ tournamentId, silent: true });
    const serverUpdatedAt = result?.data?.updatedAt;
    if (!serverUpdatedAt) return;

    const localRecord = tournamentEngine.q.tournament();
    const serverUpdated = new Date(serverUpdatedAt).getTime();
    const localUpdated = localRecord?.updatedAt ? new Date(localRecord.updatedAt).getTime() : 0;

    if (debug) console.log('[staleness] probe server=%s local=%s', serverUpdatedAt, localRecord?.updatedAt);

    if (serverUpdated > localUpdated) {
      markStaleNeedsRefresh(tournamentId);
    } else if (hadDisconnect()) {
      clearDisconnectFlag();
    }
  } catch (err) {
    console.warn('[staleness] probe failed:', err);
  } finally {
    checking = false;
  }
}

/** Periodic poll — only checks while the tab is visible (avoids background
 * round-trips). The reconnect hook covers detected drops; this catches silent
 * ones where no disconnect event fired. */
function startPolling(): void {
  if (pollInterval) clearInterval(pollInterval);
  const pollMs = getPollMs();
  if (!pollMs) return;
  pollInterval = setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    triggerStalenessCheck();
  }, pollMs);
}

/** Initialize the guard. Call once at startup. */
export function initStalenessGuard(): void {
  if (initialized) return;
  initialized = true;

  document.addEventListener('visibilitychange', onVisibilityChange);
  // On reconnect, immediately check for mutations missed while offline.
  onSocketReconnect(triggerStalenessCheck);
  resetActivityTimer();
  startPolling();
  slog('[staleness] guard initialized');
}

/** Tear down (for testing or cleanup). */
export function destroyStalenessGuard(): void {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  if (countdownInterval) clearInterval(countdownInterval);
  if (pollInterval) clearInterval(pollInterval);
  document.removeEventListener('visibilitychange', onVisibilityChange);
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

  if (debug) console.log('[staleness] page visible with staleness signal — probing');
  triggerStalenessCheck();
}

/**
 * Force the stale indicator for testing. Call from console: dev.forceStaleness()
 */
export function forceStaleness(): void {
  const { tournamentRecord } = tournamentEngine.getTournament();
  if (!tournamentRecord?.tournamentId) {
    console.warn('[staleness] no tournament loaded');
    return;
  }
  markStaleNeedsRefresh(tournamentRecord.tournamentId);
}
