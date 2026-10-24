import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const startCrowdPoller = vi.fn();
vi.mock('./crowdPoller', () => ({ startCrowdPoller: (opts: any) => startCrowdPoller(opts) }));

import {
  TRUSTED_INTERVAL_MS,
  refreshTournamentCrowdActivity,
  startTournamentCrowdPoller,
  stopTournamentCrowdPoller,
} from './tournamentCrowdPoller';
import { __resetCrowdActivityIndex, getActiveSessionCount, setActiveCountsFromSnapshot } from './crowdActivityIndex';

const stop = vi.fn();
const runOnce = vi.fn(async () => 2);

beforeEach(() => {
  __resetCrowdActivityIndex();
  startCrowdPoller.mockReturnValue({ stop, runOnce });
});

afterEach(() => {
  stopTournamentCrowdPoller();
  vi.clearAllMocks();
});

describe('tournamentCrowdPoller', () => {
  it('starts one poll per tournament and ignores a repeat start for the same one', () => {
    startTournamentCrowdPoller('t1');
    startTournamentCrowdPoller('t1');
    expect(startCrowdPoller).toHaveBeenCalledTimes(1);
    expect(startCrowdPoller).toHaveBeenCalledWith({ tournamentId: 't1' });
  });

  it('stops the previous poll when the tournament changes', () => {
    startTournamentCrowdPoller('t1');
    startTournamentCrowdPoller('t2');
    expect(stop).toHaveBeenCalledTimes(1);
    expect(startCrowdPoller).toHaveBeenLastCalledWith({ tournamentId: 't2' });
  });

  it('calls onChange once per tick however many matchUps moved', async () => {
    const onChange = vi.fn();
    startTournamentCrowdPoller('t1', onChange);
    setActiveCountsFromSnapshot([{ matchUpId: 'a' }, { matchUpId: 'b' }, { matchUpId: 'b' }]);
    await Promise.resolve();
    expect(onChange).toHaveBeenCalledTimes(1);

    setActiveCountsFromSnapshot([{ matchUpId: 'a' }, { matchUpId: 'b' }, { matchUpId: 'b' }]);
    await Promise.resolve();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('empties the index on stop so the next tournament shows no stale badges', () => {
    startTournamentCrowdPoller('t1');
    setActiveCountsFromSnapshot([{ matchUpId: 'a' }]);
    expect(getActiveSessionCount('a')).toBe(1);
    stopTournamentCrowdPoller();
    expect(getActiveSessionCount('a')).toBe(0);
  });

  it('refresh runs one poll now, and is a no-op with no tournament open', async () => {
    expect(await refreshTournamentCrowdActivity()).toBe(0);
    startTournamentCrowdPoller('t1');
    expect(await refreshTournamentCrowdActivity()).toBe(2);
    expect(runOnce).toHaveBeenCalledTimes(1);
  });

  it('polls every TRUSTED_INTERVAL_MS while a session is promoted, and stops when none is', async () => {
    vi.useFakeTimers();
    try {
      startTournamentCrowdPoller('t1');
      setActiveCountsFromSnapshot([{ matchUpId: 'a', sessionId: 's', trusted: true, currentScore: { sets: [] } }]);
      await Promise.resolve();
      vi.advanceTimersByTime(TRUSTED_INTERVAL_MS * 2);
      expect(runOnce).toHaveBeenCalledTimes(2);

      setActiveCountsFromSnapshot([{ matchUpId: 'a', sessionId: 's' }]);
      await Promise.resolve();
      vi.advanceTimersByTime(TRUSTED_INTERVAL_MS * 3);
      expect(runOnce).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
