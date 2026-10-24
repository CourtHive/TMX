import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetCrowdActivityIndex,
  getActiveSessionCount,
  getAllMatchUpsWithActivity,
  getTrustedCrowdScore,
  hasTrustedSessions,
  hasActiveCrowdActivity,
  setActiveCountsFromSnapshot,
  subscribeCrowdActivity,
} from './crowdActivityIndex';

describe('crowdActivityIndex', () => {
  beforeEach(() => {
    __resetCrowdActivityIndex();
  });

  it('returns 0 for unknown matchUps', () => {
    expect(getActiveSessionCount('mu-unknown')).toBe(0);
    expect(hasActiveCrowdActivity('mu-unknown')).toBe(false);
  });

  it('counts sessions per matchUp from a snapshot', () => {
    setActiveCountsFromSnapshot([{ matchUpId: 'mu-A' }, { matchUpId: 'mu-A' }, { matchUpId: 'mu-B' }]);
    expect(getActiveSessionCount('mu-A')).toBe(2);
    expect(getActiveSessionCount('mu-B')).toBe(1);
    expect(getAllMatchUpsWithActivity().sort()).toEqual(['mu-A', 'mu-B']);
  });

  it('drops matchUps that disappear from the next snapshot', () => {
    setActiveCountsFromSnapshot([{ matchUpId: 'mu-A' }, { matchUpId: 'mu-B' }]);
    setActiveCountsFromSnapshot([{ matchUpId: 'mu-A' }]);
    expect(getActiveSessionCount('mu-B')).toBe(0);
    expect(hasActiveCrowdActivity('mu-B')).toBe(false);
    expect(getAllMatchUpsWithActivity()).toEqual(['mu-A']);
  });

  it('only notifies listeners when a matchUp count actually changes', () => {
    const listener = vi.fn();
    subscribeCrowdActivity(listener);

    setActiveCountsFromSnapshot([{ matchUpId: 'mu-A' }, { matchUpId: 'mu-A' }]);
    expect(listener).toHaveBeenCalledExactlyOnceWith('mu-A', 2);

    listener.mockClear();
    setActiveCountsFromSnapshot([{ matchUpId: 'mu-A' }, { matchUpId: 'mu-A' }]);
    expect(listener).not.toHaveBeenCalled(); // no delta → no emit

    listener.mockClear();
    setActiveCountsFromSnapshot([{ matchUpId: 'mu-A' }]);
    expect(listener).toHaveBeenCalledExactlyOnceWith('mu-A', 1);

    listener.mockClear();
    setActiveCountsFromSnapshot([]);
    expect(listener).toHaveBeenCalledExactlyOnceWith('mu-A', 0);
  });

  it('isolates listeners that throw — others still receive the event', () => {
    const failing = vi.fn(() => {
      throw new Error('listener boom');
    });
    const healthy = vi.fn();
    subscribeCrowdActivity(failing);
    subscribeCrowdActivity(healthy);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    setActiveCountsFromSnapshot([{ matchUpId: 'mu-A' }]);

    expect(failing).toHaveBeenCalled();
    expect(healthy).toHaveBeenCalledWith('mu-A', 1);
    warnSpy.mockRestore();
  });

  it('subscribe returns an unsubscribe disposer', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCrowdActivity(listener);
    setActiveCountsFromSnapshot([{ matchUpId: 'mu-A' }]);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    listener.mockClear();
    setActiveCountsFromSnapshot([{ matchUpId: 'mu-B' }]);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('crowdActivityIndex — promoted sessions', () => {
  const score = (games: number) => ({ sets: [{ setNumber: 1, side1Score: games, side2Score: 0 }] });

  beforeEach(() => {
    __resetCrowdActivityIndex();
  });

  it('keeps the score of a promoted session and ignores unpromoted ones', () => {
    setActiveCountsFromSnapshot([
      { matchUpId: 'm1', sessionId: 's1', trusted: false, currentScore: score(1) },
      { matchUpId: 'm2', sessionId: 's2', trusted: true, currentScore: score(2), updatedAt: '2026-10-24T10:00:00Z' },
    ]);
    expect(getTrustedCrowdScore('m1')).toBeUndefined();
    expect(getTrustedCrowdScore('m2')?.currentScore).toEqual(score(2));
    expect(hasTrustedSessions()).toBe(true);
  });

  it('picks the most recently updated of two promoted sessions', () => {
    setActiveCountsFromSnapshot([
      { matchUpId: 'm1', sessionId: 'old', trusted: true, currentScore: score(1), updatedAt: '2026-10-24T10:00:00Z' },
      { matchUpId: 'm1', sessionId: 'new', trusted: true, currentScore: score(3), updatedAt: '2026-10-24T10:05:00Z' },
    ]);
    expect(getTrustedCrowdScore('m1')?.sessionId).toBe('new');
  });

  it('notifies when a promotion happens or its score moves, though the session count did not change', () => {
    const listener = vi.fn();
    setActiveCountsFromSnapshot([{ matchUpId: 'm1', sessionId: 's1', currentScore: score(1) }]);
    subscribeCrowdActivity(listener);

    setActiveCountsFromSnapshot([{ matchUpId: 'm1', sessionId: 's1', trusted: true, currentScore: score(1) }]);
    expect(listener).toHaveBeenCalledTimes(1);

    setActiveCountsFromSnapshot([{ matchUpId: 'm1', sessionId: 's1', trusted: true, currentScore: score(2) }]);
    expect(listener).toHaveBeenCalledTimes(2);

    setActiveCountsFromSnapshot([{ matchUpId: 'm1', sessionId: 's1', trusted: true, currentScore: score(2) }]);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('drops the promoted score when the session is demoted or ends', () => {
    setActiveCountsFromSnapshot([{ matchUpId: 'm1', sessionId: 's1', trusted: true, currentScore: score(1) }]);
    setActiveCountsFromSnapshot([]);
    expect(getTrustedCrowdScore('m1')).toBeUndefined();
    expect(hasTrustedSessions()).toBe(false);
  });
});
