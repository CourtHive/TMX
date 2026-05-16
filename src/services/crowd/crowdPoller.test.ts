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
  isScoreRelayConfigured: () => configuredFlag,
  scoreRelayApi: { get: (...args: any[]) => fetchSessions(...args) },
}));

vi.mock('./scoreRelayClient', () => ({
  getSessionsByTournamentId: vi.fn((...args: any[]) => fetchSessions(...args)),
}));

import { startCrowdPoller } from './crowdPoller';
import {
  __resetCrowdActivityIndex,
  getActiveSessionCount,
} from './crowdActivityIndex';

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
    expect(messages.some((m) => m.includes('poll failed'))).toBe(true);
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
