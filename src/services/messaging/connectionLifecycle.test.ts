import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ensureConnected = vi.fn(() => false);
const ensureRelayConnected = vi.fn(() => false);

vi.mock('./socketIo', () => ({ ensureConnected: () => ensureConnected() }));
vi.mock('./scoreRelay', () => ({ ensureRelayConnected: () => ensureRelayConnected() }));
vi.mock('config/debugConfig', () => ({ debugConfig: { get: () => ({ socketLog: false }) } }));

import {
  isConnectionLifecycleActive,
  startConnectionLifecycle,
  stopConnectionLifecycle,
  recoverConnections,
} from './connectionLifecycle';

/**
 * The bug this module exists for: after a back-forward-cache restore both sockets
 * are dead and nothing asks them to reconnect while the operator stays on the
 * page. `pageshow(persisted)` is the event guaranteed to fire on that restore, so
 * it is the primary path here — with a NON-persisted `pageshow` (an ordinary
 * load) as the control that must not trigger recovery.
 *
 * ── What these tests do and do not cover ──
 *
 * Vitest runs in the `node` environment, which has no `window`/`document`, and
 * the ecosystem rule is that DOM behaviour belongs to Playwright rather than
 * happy-dom. So registration is stubbed: the harness captures the handlers this
 * module registers and invokes them, which verifies the event→recovery mapping
 * and the throttle.
 *
 * It does NOT verify that a real browser fires `pageshow(persisted)` on a bfcache
 * restore, nor that a real frozen socket recovers. That is a browser behaviour;
 * stating it plainly is better than a test that appears to cover it.
 */

type Listener = (event?: any) => void;

const windowListeners = new Map<string, Set<Listener>>();
const documentListeners = new Map<string, Set<Listener>>();
let visibilityState: 'visible' | 'hidden' = 'visible';

function register(map: Map<string, Set<Listener>>) {
  return (name: string, fn: Listener) => {
    const set = map.get(name) ?? new Set<Listener>();
    set.add(fn);
    map.set(name, set);
  };
}

function unregister(map: Map<string, Set<Listener>>) {
  return (name: string, fn: Listener) => map.get(name)?.delete(fn);
}

/** Invoke every handler registered for an event, as the browser would. */
function fire(map: Map<string, Set<Listener>>, name: string, event?: any): void {
  for (const fn of map.get(name) ?? []) fn(event);
}

const firePageShow = (persisted: boolean) => fire(windowListeners, 'pageshow', { persisted });
const fireOnline = () => fire(windowListeners, 'online');
const fireVisibility = (state: 'visible' | 'hidden') => {
  visibilityState = state;
  fire(documentListeners, 'visibilitychange');
};

const registeredWindowEvents = () => [...windowListeners.keys()].filter((k) => (windowListeners.get(k)?.size ?? 0) > 0);
const handlerCount = (map: Map<string, Set<Listener>>, name: string) => map.get(name)?.size ?? 0;

describe('connectionLifecycle', () => {
  beforeEach(() => {
    ensureConnected.mockReset().mockReturnValue(false);
    ensureRelayConnected.mockReset().mockReturnValue(false);
    windowListeners.clear();
    documentListeners.clear();
    visibilityState = 'visible';

    vi.stubGlobal('addEventListener', register(windowListeners));
    vi.stubGlobal('removeEventListener', unregister(windowListeners));
    vi.stubGlobal('document', {
      addEventListener: register(documentListeners),
      removeEventListener: unregister(documentListeners),
      get visibilityState() {
        return visibilityState;
      },
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T12:00:00Z'));
    stopConnectionLifecycle();
  });

  afterEach(() => {
    stopConnectionLifecycle();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('registration', () => {
    it('is inactive until started', () => {
      expect(isConnectionLifecycleActive()).toBe(false);
      expect(registeredWindowEvents()).toEqual([]);
    });

    it('registers exactly pageshow + online on window and visibilitychange on document', () => {
      startConnectionLifecycle();
      expect(isConnectionLifecycleActive()).toBe(true);
      expect(registeredWindowEvents().toSorted((a, b) => a.localeCompare(b))).toEqual(['online', 'pageshow']);
      expect(handlerCount(documentListeners, 'visibilitychange')).toBe(1);
    });

    it('removes every listener on stop', () => {
      startConnectionLifecycle();
      stopConnectionLifecycle();
      expect(isConnectionLifecycleActive()).toBe(false);
      expect(handlerCount(windowListeners, 'pageshow')).toBe(0);
      expect(handlerCount(windowListeners, 'online')).toBe(0);
      expect(handlerCount(documentListeners, 'visibilitychange')).toBe(0);
    });

    it('is idempotent — a second start does not add a second handler set', () => {
      startConnectionLifecycle();
      startConnectionLifecycle();
      expect(handlerCount(windowListeners, 'pageshow')).toBe(1);
      expect(handlerCount(documentListeners, 'visibilitychange')).toBe(1);
    });

    it('does not recover after stop', () => {
      startConnectionLifecycle();
      stopConnectionLifecycle();
      firePageShow(true);
      expect(ensureConnected).not.toHaveBeenCalled();
    });
  });

  describe('bfcache restore — the reported bug', () => {
    it('recovers both sockets on pageshow(persisted)', () => {
      startConnectionLifecycle();
      firePageShow(true);
      expect(ensureConnected).toHaveBeenCalledTimes(1);
      expect(ensureRelayConnected).toHaveBeenCalledTimes(1);
    });

    it('does NOT recover on a non-persisted pageshow (ordinary load)', () => {
      startConnectionLifecycle();
      firePageShow(false);
      expect(ensureConnected).not.toHaveBeenCalled();
      expect(ensureRelayConnected).not.toHaveBeenCalled();
    });
  });

  describe('other triggers', () => {
    it('recovers when the tab becomes visible', () => {
      startConnectionLifecycle();
      fireVisibility('visible');
      expect(ensureConnected).toHaveBeenCalledTimes(1);
    });

    it('does not recover when the tab becomes hidden', () => {
      startConnectionLifecycle();
      fireVisibility('hidden');
      expect(ensureConnected).not.toHaveBeenCalled();
    });

    it('recovers when the network returns', () => {
      startConnectionLifecycle();
      fireOnline();
      expect(ensureConnected).toHaveBeenCalledTimes(1);
    });
  });

  describe('throttle', () => {
    it('collapses a burst of events into one sweep', () => {
      startConnectionLifecycle();
      firePageShow(true);
      fireVisibility('visible');
      fireOnline();
      // A single tab return can fire all three; one handshake attempt, not three.
      expect(ensureConnected).toHaveBeenCalledTimes(1);
    });

    it('allows another sweep once the window has passed', () => {
      startConnectionLifecycle();
      firePageShow(true);
      expect(ensureConnected).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(2001);
      firePageShow(true);
      expect(ensureConnected).toHaveBeenCalledTimes(2);
    });

    it('still suppresses one millisecond before the window closes', () => {
      startConnectionLifecycle();
      firePageShow(true);
      vi.advanceTimersByTime(1999);
      firePageShow(true);
      // Pins the 2000ms floor — shortening it breaks this case.
      expect(ensureConnected).toHaveBeenCalledTimes(1);
    });
  });

  describe('the two sockets are independent', () => {
    it('reports each outcome separately', () => {
      ensureConnected.mockReturnValue(false);
      ensureRelayConnected.mockReturnValue(true);
      expect(recoverConnections('test')).toEqual({ socket: false, relay: true });

      ensureConnected.mockReturnValue(true);
      ensureRelayConnected.mockReturnValue(false);
      expect(recoverConnections('test')).toEqual({ socket: true, relay: false });
    });

    it('attempts the socket BEFORE the relay, so a throwing relay cannot mask it', () => {
      ensureRelayConnected.mockImplementation(() => {
        throw new Error('relay boom');
      });
      expect(() => recoverConnections('test')).toThrow('relay boom');
      expect(ensureConnected).toHaveBeenCalledTimes(1);
    });
  });
});
