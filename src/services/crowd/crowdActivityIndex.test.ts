import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetCrowdActivityIndex,
  getActiveSessionCount,
  getAllMatchUpsWithActivity,
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
    setActiveCountsFromSnapshot([
      { matchUpId: 'mu-A' },
      { matchUpId: 'mu-A' },
      { matchUpId: 'mu-B' },
    ]);
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
