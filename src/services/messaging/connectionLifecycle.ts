/**
 * Page-lifecycle → socket recovery.
 *
 * The missing half of TMX's reconnection story. `ensureConnected()` (the `/tmx`
 * socket) and `ensureRelayConnected()` (score-relay) both knew how to recover,
 * but the only thing calling either was the router — so recovery happened on
 * navigation and at no other time. An operator who left the tab, came back, and
 * simply *sat* on the page stayed disconnected indefinitely.
 *
 * ── Why the back-forward cache is the trigger that matters ──
 *
 * Chrome and Safari freeze a page when the operator navigates away, keeping it
 * in the back-forward cache so a return is instant. A frozen page cannot hold an
 * open socket, so the browser closes both of ours — visible in the console as:
 *
 *     WebSocket connection to 'wss://…/socket.io/…' failed:
 *     Page entered Back-Forward Cache.
 *
 * On restore the page resumes with its JS heap intact and its sockets dead. No
 * `visibilitychange` fires for a bfcache restore in every engine, so the one
 * event that is guaranteed is `pageshow` with `event.persisted === true`. That is
 * the primary hook here.
 *
 * Three events, because each covers a case the others miss:
 *
 *   - `pageshow` (persisted) — bfcache restore. The reported bug.
 *   - `visibilitychange` → visible — tab switch, window refocus, phone unlock;
 *     these do not always involve bfcache but can still outlive a socket timeout.
 *   - `online` — the network came back; the OS knows before socket.io's next
 *     scheduled retry does.
 *
 * And one on the way OUT: `pagehide` with `persisted` (the page is about to be frozen into the cache) suspends every
 * socket — `/tmx`, the scoring relay, and the chat relay's room and monitor sockets — keeping each one and its
 * subscriptions. The browser then has nothing open to kill, so it stops logging "Page entered Back-Forward Cache", and
 * a page without open sockets is more likely to be cached at all. `pageshow` reopens them through the sweep below.
 *
 * Deliberately additive: existing `visibilitychange` listeners
 * (`stalenessGuard`, `checkTmxVersion`, `schedulingTab`) check *data* and version
 * freshness and never socket health. `stalenessGuard` in particular re-fetches
 * the tournament on return while leaving the socket dead, which is why the
 * symptom read as intermittent — one fresh snapshot, then silence.
 */

import { resumeAmsChat, suspendAmsChat } from 'services/chat/amsChatTransport';
import { ensureRelayConnected, suspendRelay } from './scoreRelay';
import { ensureConnected, suspendSocket } from './socketIo';
import { debugConfig } from 'config/debugConfig';

const slog = (...args: any[]) => debugConfig.get().socketLog && console.log(...args);

/**
 * Minimum gap between recovery sweeps. A tab switch can fire `visibilitychange`
 * and `pageshow` back to back, and `online` may arrive alongside both; without a
 * floor, one return could trigger three handshakes.
 */
const SWEEP_THROTTLE_MS = 2000;

let lastSweep = 0;
let listening = false;

/** Exposed for tests: the recovery sweep, ignoring the throttle. */
export function recoverConnections(reason: string): { socket: boolean; relay: boolean; chat: boolean } {
  // Each is attempted independently — the /tmx socket, the scoring relay and the chat relay fail and
  // recover separately, and a dead one must not mask another.
  const socket = ensureConnected();
  const relay = ensureRelayConnected();
  const chat = resumeAmsChat();
  if (socket || relay || chat) {
    // DELIBERATELY NOT behind `socketLog`. This fires only when a reconnect was actually initiated —
    // a rare, meaningful event, not a trace — and it is the only way to tell from a deployed build
    // that recovery ran at all.
    //
    // That distinction was not academic: the bfcache messages Chrome logs on freeze
    // ("Page entered Back-Forward Cache") look identical whether or not recovery works, so the fix
    // was reported as broken on 8.19.0 when it was in fact working. `socketLog` could not settle it
    // because it is the one debug flag with no setter in env.ts — every slog() call is unreachable
    // in a deployed build. Answering "did recovery run?" must not depend on a flag nobody can set.
    console.log('[lifecycle] recovery after %s — socket=%s relay=%s chat=%s', reason, socket, relay, chat);
  }
  return { socket, relay, chat };
}

/** Exposed for tests: close every socket ahead of a back-forward-cache freeze, keeping each for `recoverConnections`. */
export function suspendConnections(): void {
  suspendSocket();
  suspendRelay();
  suspendAmsChat();
}

function throttledRecover(reason: string): void {
  const now = Date.now();
  if (now - lastSweep < SWEEP_THROTTLE_MS) {
    slog('[lifecycle] %s within throttle window — skipping', reason);
    return;
  }
  lastSweep = now;
  recoverConnections(reason);
}

function onPageShow(event: Event): void {
  // A non-persisted pageshow is an ordinary load, which already connects through
  // the normal boot path; only a bfcache restore needs recovery.
  if (!(event as PageTransitionEvent).persisted) return;
  throttledRecover('pageshow(persisted)');
}

function onPageHide(event: Event): void {
  // Only a page going INTO the cache is suspended; an unload needs nothing.
  if (!(event as PageTransitionEvent).persisted) return;
  slog('[lifecycle] pagehide(persisted) — suspending sockets for the back-forward cache');
  suspendConnections();
  // The restore must sweep even if it lands within the throttle window of a sweep made just before the freeze.
  lastSweep = 0;
}

function onVisibilityChange(): void {
  if (document.visibilityState !== 'visible') return;
  throttledRecover('visibilitychange(visible)');
}

function onOnline(): void {
  throttledRecover('online');
}

/**
 * Start listening. Idempotent — a second call is a no-op rather than a second
 * set of listeners, so a re-entrant boot cannot double the handshakes.
 */
export function startConnectionLifecycle(): void {
  if (listening) return;
  listening = true;
  globalThis.addEventListener('pageshow', onPageShow);
  globalThis.addEventListener('pagehide', onPageHide);
  globalThis.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisibilityChange);
  slog('[lifecycle] connection lifecycle listeners registered');
}

export function stopConnectionLifecycle(): void {
  if (!listening) return;
  listening = false;
  globalThis.removeEventListener('pageshow', onPageShow);
  globalThis.removeEventListener('pagehide', onPageHide);
  globalThis.removeEventListener('online', onOnline);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  lastSweep = 0;
}

/** Exposed for tests. */
export function isConnectionLifecycleActive(): boolean {
  return listening;
}
