import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('services/notifications/tmxToast', () => ({ tmxToast: vi.fn() }));

const memStore: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memStore[k] ?? null,
  setItem: (k: string, v: string) => {
    memStore[k] = v;
  },
  removeItem: (k: string) => {
    delete memStore[k];
  },
  clear: () => {
    for (const k of Object.keys(memStore)) delete memStore[k];
  },
});

let configuredFlag = true;
const fetchSessions = vi.fn();

vi.mock('services/apis/scoreRelayApi', () => ({
  isCrowdScoringEnabled: () => configuredFlag,
  scoreRelayApi: { get: (...args: any[]) => fetchSessions(...args) },
}));

vi.mock('./scoreRelayClient', () => ({
  getSessionsByTournamentId: vi.fn((...args: any[]) => fetchSessions(...args)),
}));

import { MAX_AUTH_BACKOFF_MS, startCrowdPoller } from './crowdPoller';
import { __resetCrowdActivityIndex, getActiveSessionCount } from './crowdActivityIndex';

const POLL_FAILED = 'poll failed';

describe('crowdPoller', () => {
  beforeEach(() => {
    __resetCrowdActivityIndex();
    fetchSessions.mockReset();
    configuredFlag = true;
  });

  it('fires an immediate poll on start and fans counts into the index', async () => {
    fetchSessions.mockResolvedValue([
      { sessionId: 's1', matchUpId: 'mu-A' },
      { sessionId: 's2', matchUpId: 'mu-A' },
      { sessionId: 's3', matchUpId: 'mu-B' },
    ]);

    const poller = startCrowdPoller({
      tournamentId: 'tour-X',
      setTimer: () => 0,
      clearTimer: () => undefined,
    });

    let count: any = await poller.runOnce();
    expect(count).toBe(3);
    expect(getActiveSessionCount('mu-A')).toBe(2);
    expect(getActiveSessionCount('mu-B')).toBe(1);
    poller.stop();
  });

  it('returns 0 when score-relay is not configured', async () => {
    configuredFlag = false;
    const poller = startCrowdPoller({
      tournamentId: 'tour-X',
      setTimer: () => 0,
      clearTimer: () => undefined,
    });
    let count: any = await poller.runOnce();
    expect(count).toBe(0);
    expect(fetchSessions).not.toHaveBeenCalled();
    poller.stop();
  });

  it('swallows errors so the next tick still runs', async () => {
    fetchSessions.mockRejectedValueOnce(new Error('relay down'));
    const messages: string[] = [];
    const poller = startCrowdPoller({
      tournamentId: 'tour-X',
      logger: (m) => messages.push(m),
      setTimer: () => 0,
      clearTimer: () => undefined,
    });
    let count: any = await poller.runOnce();
    expect(count).toBe(0);
    expect(messages.some((m) => m.includes(POLL_FAILED))).toBe(true);
    poller.stop();
  });

  it('schedules periodic polls via the injected setTimer', () => {
    fetchSessions.mockResolvedValue([]);
    const setTimer = vi.fn().mockReturnValue(99);
    const clearTimer = vi.fn();
    const poller = startCrowdPoller({ tournamentId: 'tour-X', intervalMs: 12_345, setTimer, clearTimer });
    expect(setTimer).toHaveBeenCalledOnce();
    expect(setTimer.mock.calls[0][1]).toBe(12_345);
    poller.stop();
    expect(clearTimer).toHaveBeenCalledWith(99);
  });

  it('stop() is idempotent', () => {
    fetchSessions.mockResolvedValue([]);
    const clearTimer = vi.fn();
    const poller = startCrowdPoller({
      tournamentId: 'tour-X',
      setTimer: () => 1,
      clearTimer,
    });
    poller.stop();
    poller.stop();
    poller.stop();
    expect(clearTimer).toHaveBeenCalledOnce();
  });
});

// A relay refusal (401/403) that survives scoreRelayApi's refresh gets the same answer on the next tick, so the poller
// backs off instead of polling — and logging — every 45s (2026-11-08).
describe('crowdPoller — auth refusal backoff', () => {
  const refusal = (status: number) =>
    Object.assign(new Error(`Request failed with status code ${status}`), { response: { status } });
  const flush = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };

  function harness() {
    let tick: () => void = () => {};
    let clock = 0;
    const logs: string[] = [];
    const poller = startCrowdPoller({
      tournamentId: 'tour-X',
      intervalMs: 45_000,
      setTimer: (handler) => {
        tick = handler;
        return 1;
      },
      clearTimer: () => {},
      now: () => clock,
      logger: (m) => logs.push(m),
    });
    const advance = async (ms: number) => {
      clock += ms;
      tick();
      await flush();
    };
    return { poller, advance, logs };
  }

  beforeEach(() => {
    __resetCrowdActivityIndex();
    fetchSessions.mockReset();
    configuredFlag = true;
  });

  it('skips ticks on a doubling backoff while the relay refuses, and logs the streak once', async () => {
    fetchSessions.mockRejectedValue(refusal(401));
    const { advance, logs } = harness();
    await flush(); // the immediate poll: 1st refusal → back off 45s
    expect(fetchSessions).toHaveBeenCalledTimes(1);

    await advance(45_000); // due → 2nd refusal → back off 90s
    expect(fetchSessions).toHaveBeenCalledTimes(2);
    await advance(45_000); // inside the 90s backoff → skipped
    expect(fetchSessions).toHaveBeenCalledTimes(2);
    await advance(45_000); // 90s elapsed → polls
    expect(fetchSessions).toHaveBeenCalledTimes(3);

    expect(logs.filter((m) => m.includes('refused'))).toHaveLength(1);
    expect(logs.some((m) => m.includes(POLL_FAILED))).toBe(false);
  });

  it('caps the backoff at ten minutes', async () => {
    fetchSessions.mockRejectedValue(refusal(403));
    const { advance } = harness();
    await flush();
    for (let i = 0; i < 40; i++) await advance(45_000); // 30 minutes of ticks
    const calls = fetchSessions.mock.calls.length;
    await advance(MAX_AUTH_BACKOFF_MS); // at most one cap later it must poll again
    expect(fetchSessions.mock.calls.length).toBe(calls + 1);
  });

  it('resumes normal polling, and says so, once the relay accepts the session again', async () => {
    fetchSessions.mockRejectedValueOnce(refusal(401)).mockResolvedValue([{ sessionId: 's1', matchUpId: 'mu-A' }]);
    const { advance, logs } = harness();
    await flush();
    await advance(45_000);
    expect(getActiveSessionCount('mu-A')).toBe(1);
    expect(logs.some((m) => m.includes('accepted the session again'))).toBe(true);
    await advance(45_000);
    expect(fetchSessions).toHaveBeenCalledTimes(3);
  });

  it('keeps logging other failures as before (no backoff for a network error)', async () => {
    fetchSessions.mockRejectedValue(new Error('Network Error'));
    const { advance, logs } = harness();
    await flush();
    await advance(45_000);
    expect(fetchSessions).toHaveBeenCalledTimes(2);
    expect(logs.filter((m) => m.includes(POLL_FAILED))).toHaveLength(2);
  });

  it('an explicit runOnce still polls during a backoff', async () => {
    fetchSessions.mockRejectedValue(refusal(401));
    const { poller } = harness();
    await flush();
    await poller.runOnce();
    expect(fetchSessions).toHaveBeenCalledTimes(2);
  });
});
