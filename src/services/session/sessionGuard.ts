/**
 * Session guard — turns a silent, expired-session failure into a clear,
 * recoverable UX.
 *
 * The bug this closes: a user whose access token expires while a
 * provider-bound tournament is still on screen (loaded from IndexedDB) used to
 * get a misleading "Server not responding" toast when a save failed — implying
 * our infrastructure was down — with no indication they needed to log back in,
 * and the edit was silently dropped. The socket also kept presenting the stale
 * token after a refresh, so nothing they did would save.
 *
 * Responsibilities:
 *  - Surface a persistent, theme-aware banner the moment the session is known
 *    to be lost (server auth rejection, mutation auth failure, or a proactive
 *    expiry check) — never a "server down" message for an auth problem.
 *  - Attempt automatic recovery (silent refresh + fresh-token socket reconnect)
 *    before asking the user to do anything.
 *  - Preserve the in-flight edit and replay it once the session is restored, so
 *    the user does not lose work.
 *
 * All auth-state reads go through loginState/tokenManagement; the socket is the
 * only transport touched. No factory mutation happens here — callers hand us a
 * self-contained replay thunk, so this module never needs to know what an edit
 * does (and there is no import cycle through mutationRequest).
 */
import { getToken, getRefreshToken } from 'services/authentication/tokenManagement';
import { getLoginState, attemptSilentRefresh } from 'services/authentication/loginState';
import { reconnectSocket, onSocketReconnect } from 'services/messaging/socketIo';
import { buildInlineNotice } from 'components/notices/inlineNotice';
import { tournamentEngine } from 'services/factory/engine';
import { t } from 'i18n';

const MOUNT_ID = 'navMain';
const BANNER_ID = 'session-expiry-banner';
const MAX_PENDING_RETRIES = 25;
const PROACTIVE_INTERVAL_MS = 30_000;

/** Replay thunks for edits that failed while the session was lost. Flushed on
 * the next successful socket reconnect (see `initSessionGuard`). */
const pendingRetries: Array<() => void> = [];

let bannerEl: HTMLElement | undefined;
/** Banner visibility tracked independently of the DOM node so the flow is
 * unit-testable in a node (no-DOM) environment; the node is created lazily only
 * when a document is present. */
let bannerVisible = false;
/** Coalesce concurrent recovery attempts — many rejected messages can arrive
 * in a burst; we only run one silent-refresh/reconnect cycle at a time. */
let recovering = false;
let proactiveTimer: ReturnType<typeof setInterval> | undefined;

// ── Observability (architectural-standards A2: fail-soft must surface) ──
let authFailureCount = 0;
let sawFailureSinceRecovery = false;

function noteAuthFailure(source: string): void {
  authFailureCount += 1;
  sawFailureSinceRecovery = true;
  // First failure loud; then powers-of-ten; then every 50th. Avoids spamming a
  // line per rejected message during a burst while never going fully silent.
  const milestone =
    authFailureCount === 1 ||
    authFailureCount === 10 ||
    authFailureCount === 100 ||
    authFailureCount === 1000 ||
    authFailureCount % 50 === 0;
  if (milestone) {
    console.warn(`[sessionGuard] auth failure #${authFailureCount} (source: ${source}) — session lost`);
  }
}

function noteRecovery(): void {
  if (sawFailureSinceRecovery) {
    console.warn(`[sessionGuard] session recovered after ${authFailureCount} auth failure(s)`);
    sawFailureSinceRecovery = false;
  }
}

// ── Session-state predicates ──

/** A valid, unexpired access token is present. */
export function isSessionValid(): boolean {
  return !!getLoginState();
}

/** The engine currently holds a provider-bound tournament — i.e. the user has
 * real, server-backed work loaded that a lost session would strand. Local-only
 * scratch tournaments (no parentOrganisation) are excluded, so a deliberate
 * logout to the tournaments list never triggers the banner. */
function hasProviderWorkLoaded(): boolean {
  try {
    return !!tournamentEngine.getTournament().tournamentRecord?.parentOrganisation?.organisationId;
  } catch {
    return false;
  }
}

/** True when the session is invalid AND cannot silently recover on its own
 * (no token at all, or an expired token with no refresh token to exchange). */
function isUnrecoverable(): boolean {
  if (isSessionValid()) return false;
  const hasRefresh = !!getRefreshToken();
  const hasAccess = !!getToken();
  // A refresh token present means validateToken() has already kicked off a
  // silent refresh — give it a chance rather than bannering mid-exchange.
  return !hasRefresh || !hasAccess;
}

// ── Banner ──

function mountBanner(el: HTMLElement): void {
  const anchor = document.getElementById(MOUNT_ID);
  const parent = anchor?.parentNode ?? document.body;
  if (anchor?.parentNode) parent.insertBefore(el, anchor);
  else parent.appendChild(el);
}

function showBanner(): void {
  if (bannerVisible) return;
  bannerVisible = true;
  if (typeof document === 'undefined') return;
  bannerEl = buildInlineNotice({
    intent: 'danger',
    message: t('session.expiredMessage', {
      defaultValue: 'Your session has expired. Changes will not be saved until you log in again.',
    }),
    action: {
      label: t('session.logInAgain', { defaultValue: 'Log in again' }),
      // Lazy-load the login modal only on click — keeps courthive-components (a
      // DOM-touching module) out of this guard's static import graph so it stays
      // node-testable and cheap to load at boot.
      onClick: () => void import('components/modals/loginModal').then((m) => m.loginModal()),
    },
  });
  bannerEl.id = BANNER_ID;
  mountBanner(bannerEl);
}

function hideBanner(): void {
  bannerVisible = false;
  bannerEl?.remove();
  bannerEl = undefined;
}

/** Test/inspection helper: is the session-expiry banner currently shown? */
export function isSessionBannerVisible(): boolean {
  return bannerVisible;
}

// ── Recovery ──

function flushPendingRetries(): void {
  if (!pendingRetries.length) return;
  const batch = pendingRetries.splice(0, pendingRetries.length);
  for (const retry of batch) {
    try {
      retry();
    } catch (err) {
      console.error('[sessionGuard] pending mutation replay failed', err);
    }
  }
}

/** Attempt to restore the session without user interaction: exchange the
 * refresh token, then force a fresh-token socket reconnect (which fires the
 * reconnect listener that flushes preserved edits). Coalesced. */
async function attemptRecovery(): Promise<void> {
  if (recovering) return;
  recovering = true;
  try {
    if (isSessionValid()) {
      onRecovered();
      return;
    }
    const refreshed = await attemptSilentRefresh();
    if (refreshed) {
      onRecovered();
    }
    // On failure, attemptSilentRefresh() has already logged out; the banner
    // stays up and its "Log in again" action drives manual recovery.
  } finally {
    recovering = false;
  }
}

function onRecovered(): void {
  noteRecovery();
  hideBanner();
  // Present the fresh token on the wire and replay preserved edits once the
  // socket is back (the reconnect listener registered in initSessionGuard runs
  // flushPendingRetries).
  reconnectSocket();
}

// ── Public entry points ──

/**
 * Report that the session is (or may be) lost. Idempotent and safe to call
 * repeatedly during a burst of rejected messages. Optionally accepts a
 * self-contained `retry` thunk that re-issues the failed edit; it is preserved
 * and replayed after the session is restored.
 */
export function reportSessionLost(opts?: { retry?: () => void; source?: string }): void {
  noteAuthFailure(opts?.source ?? 'unknown');
  if (opts?.retry) {
    pendingRetries.push(opts.retry);
    // Cap the buffer so a wedged session can't grow it without bound.
    if (pendingRetries.length > MAX_PENDING_RETRIES) pendingRetries.shift();
  }
  showBanner();
  void attemptRecovery();
}

/**
 * Classify a raw socket `exception` payload and, when it is an authentication
 * failure, drive the session-lost flow. Non-auth exceptions are returned as
 * `false` so the caller can handle them (e.g. log) without triggering the
 * banner.
 */
export function handleSocketException(payload: any): boolean {
  const message = typeof payload === 'string' ? payload : (payload?.message ?? payload?.name ?? '');
  const text = String(message).toLowerCase();
  const isAuth =
    text.includes('token') ||
    text.includes('logged') ||
    text.includes('unauthorized') ||
    text.includes('jwt') ||
    text.includes('expired') ||
    text.includes('audience');
  if (!isAuth) return false;
  reportSessionLost({ source: 'socket-exception' });
  return true;
}

/**
 * Called by the auth layer whenever a login (interactive or silent) succeeds,
 * so any banner clears and preserved edits replay regardless of how the user
 * recovered (banner action, login menu, or an automatic refresh elsewhere).
 */
export function notifySessionRecovered(): void {
  onRecovered();
}

/** Proactive tick: banner the moment provider work is stranded by a session
 * that cannot silently recover — before the user even attempts a save. */
function proactiveCheck(): void {
  if (recovering) return;
  if (isSessionValid()) {
    hideBanner();
    return;
  }
  if (!hasProviderWorkLoaded()) return;
  if (isUnrecoverable()) {
    reportSessionLost({ source: 'proactive' });
  }
}

/** Start the guard. Registers the reconnect-driven replay flush and a
 * conservative proactive expiry watcher. Safe to call once at boot. */
export function initSessionGuard(): void {
  onSocketReconnect(flushPendingRetries);
  if (proactiveTimer) return;
  if (typeof setInterval !== 'function') return;
  proactiveTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    proactiveCheck();
  }, PROACTIVE_INTERVAL_MS);
}

/** Test-only: reset all module state. */
export function __resetSessionGuardForTest(): void {
  pendingRetries.length = 0;
  hideBanner();
  recovering = false;
  authFailureCount = 0;
  sawFailureSinceRecovery = false;
  if (proactiveTimer) {
    clearInterval(proactiveTimer);
    proactiveTimer = undefined;
  }
}
