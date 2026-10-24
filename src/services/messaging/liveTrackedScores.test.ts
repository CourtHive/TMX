/**
 * Unit tests for liveTrackedScores — the persistent badge state behind
 * the "score was reported via the live tracker" indicator. Covers basic
 * mark/read, persistence, rehydration, per-tournament isolation, the
 * 24-hour TTL, and the completion-driven prune.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _resetLiveTrackedScoresForTest,
  clearActiveLiveTrackedScores,
  isMatchUpLiveTracked,
  getLiveTrackedScore,
  loadLiveTrackedScores,
  recordLiveTrackedScore,
  pruneCompletedMatchUps,
} from './liveTrackedScores';

const TOURNAMENT_A = 'tournament-a';
const TOURNAMENT_B = 'tournament-b';
const STORAGE_KEY_A = `liveTrackedScores:${TOURNAMENT_A}`;
const STORAGE_KEY_B = `liveTrackedScores:${TOURNAMENT_B}`;

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  (globalThis as any).localStorage = storage;
  _resetLiveTrackedScoresForTest();
});

afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as any).localStorage;
});

describe('liveTrackedScores', () => {
  it('marks a matchUp and reports it as live-tracked', () => {
    loadLiveTrackedScores(TOURNAMENT_A);
    recordLiveTrackedScore('m1');
    expect(isMatchUpLiveTracked('m1')).toBe(true);
    expect(isMatchUpLiveTracked('m2')).toBe(false);
  });

  it('persists each mark to localStorage with a lastSeenAt timestamp', () => {
    loadLiveTrackedScores(TOURNAMENT_A);
    recordLiveTrackedScore('m1');
    recordLiveTrackedScore('m2');
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY_A)!);
    expect(Object.keys(parsed).sort()).toEqual(['m1', 'm2']);
    expect(typeof parsed.m1.lastSeenAt).toBe('string');
    expect(typeof parsed.m2.lastSeenAt).toBe('string');
  });

  it('refreshes lastSeenAt on a repeat mark so the 24h countdown rolls forward', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T10:00:00Z'));
    loadLiveTrackedScores(TOURNAMENT_A);
    recordLiveTrackedScore('m1');
    const firstTimestamp = JSON.parse(storage.getItem(STORAGE_KEY_A)!).m1.lastSeenAt;

    vi.setSystemTime(new Date('2026-05-15T20:00:00Z'));
    recordLiveTrackedScore('m1');
    const secondTimestamp = JSON.parse(storage.getItem(STORAGE_KEY_A)!).m1.lastSeenAt;

    expect(secondTimestamp).not.toBe(firstTimestamp);
    expect(Date.parse(secondTimestamp)).toBeGreaterThan(Date.parse(firstTimestamp));
  });

  it('rehydrates from localStorage on load', () => {
    storage.setItem(
      STORAGE_KEY_A,
      JSON.stringify({
        m1: { lastSeenAt: new Date().toISOString() },
        m3: { lastSeenAt: new Date().toISOString() },
      }),
    );
    loadLiveTrackedScores(TOURNAMENT_A);
    expect(isMatchUpLiveTracked('m1')).toBe(true);
    expect(isMatchUpLiveTracked('m3')).toBe(true);
    expect(isMatchUpLiveTracked('m2')).toBe(false);
  });

  it('drops entries older than 24 hours on load', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));

    storage.setItem(
      STORAGE_KEY_A,
      JSON.stringify({
        recent: { lastSeenAt: '2026-05-15T06:00:00Z' }, // 6h ago — keep
        stale: { lastSeenAt: '2026-05-14T06:00:00Z' }, // 30h ago — drop
        edge: { lastSeenAt: '2026-05-14T12:00:01Z' }, // 23h 59m 59s ago — keep
      }),
    );

    loadLiveTrackedScores(TOURNAMENT_A);

    expect(isMatchUpLiveTracked('recent')).toBe(true);
    expect(isMatchUpLiveTracked('edge')).toBe(true);
    expect(isMatchUpLiveTracked('stale')).toBe(false);

    // Persisted storage should reflect the prune.
    const remaining = JSON.parse(storage.getItem(STORAGE_KEY_A)!);
    expect(Object.keys(remaining).sort()).toEqual(['edge', 'recent']);
  });

  it('pruneCompletedMatchUps removes specified ids and persists', () => {
    loadLiveTrackedScores(TOURNAMENT_A);
    recordLiveTrackedScore('m1');
    recordLiveTrackedScore('m2');
    recordLiveTrackedScore('m3');

    const removed = pruneCompletedMatchUps(['m1', 'm3']);

    expect(removed).toBe(2);
    expect(isMatchUpLiveTracked('m1')).toBe(false);
    expect(isMatchUpLiveTracked('m2')).toBe(true);
    expect(isMatchUpLiveTracked('m3')).toBe(false);

    const persisted = JSON.parse(storage.getItem(STORAGE_KEY_A)!);
    expect(Object.keys(persisted)).toEqual(['m2']);
  });

  it('pruneCompletedMatchUps removes the localStorage key entirely when the map empties', () => {
    loadLiveTrackedScores(TOURNAMENT_A);
    recordLiveTrackedScore('m1');
    pruneCompletedMatchUps(['m1']);
    expect(storage.getItem(STORAGE_KEY_A)).toBeNull();
  });

  it('pruneCompletedMatchUps is a no-op when nothing matches', () => {
    loadLiveTrackedScores(TOURNAMENT_A);
    recordLiveTrackedScore('m1');
    const removed = pruneCompletedMatchUps(['unknown']);
    expect(removed).toBe(0);
    expect(isMatchUpLiveTracked('m1')).toBe(true);
  });

  it('isolates entries per tournament', () => {
    loadLiveTrackedScores(TOURNAMENT_A);
    recordLiveTrackedScore('m1');
    loadLiveTrackedScores(TOURNAMENT_B);
    recordLiveTrackedScore('m2');

    expect(isMatchUpLiveTracked('m1')).toBe(false);
    expect(isMatchUpLiveTracked('m2')).toBe(true);

    expect(Object.keys(JSON.parse(storage.getItem(STORAGE_KEY_A)!))).toEqual(['m1']);
    expect(Object.keys(JSON.parse(storage.getItem(STORAGE_KEY_B)!))).toEqual(['m2']);
  });

  it('ignores marks before a tournament has been loaded', () => {
    recordLiveTrackedScore('m1');
    loadLiveTrackedScores(TOURNAMENT_A);
    expect(isMatchUpLiveTracked('m1')).toBe(false);
  });

  it('ignores falsy matchUpIds', () => {
    loadLiveTrackedScores(TOURNAMENT_A);
    recordLiveTrackedScore(undefined);
    recordLiveTrackedScore('');
    expect(storage.getItem(STORAGE_KEY_A)).toBeNull();
    expect(isMatchUpLiveTracked(undefined)).toBe(false);
    expect(isMatchUpLiveTracked('')).toBe(false);
  });

  it('survives corrupt localStorage payloads by falling back to an empty map', () => {
    storage.setItem(STORAGE_KEY_A, 'not-json');
    loadLiveTrackedScores(TOURNAMENT_A);
    expect(isMatchUpLiveTracked('m1')).toBe(false);
    recordLiveTrackedScore('m1');
    expect(isMatchUpLiveTracked('m1')).toBe(true);
  });

  it('rejects array-shaped payloads (legacy schema) on load', () => {
    storage.setItem(STORAGE_KEY_A, JSON.stringify(['m1', 'm2']));
    loadLiveTrackedScores(TOURNAMENT_A);
    expect(isMatchUpLiveTracked('m1')).toBe(false);
    expect(isMatchUpLiveTracked('m2')).toBe(false);
  });

  it('skips entries whose lastSeenAt is not a string', () => {
    storage.setItem(
      STORAGE_KEY_A,
      JSON.stringify({
        good: { lastSeenAt: new Date().toISOString() },
        bad: { lastSeenAt: 42 },
        empty: null,
      }),
    );
    loadLiveTrackedScores(TOURNAMENT_A);
    expect(isMatchUpLiveTracked('good')).toBe(true);
    expect(isMatchUpLiveTracked('bad')).toBe(false);
    expect(isMatchUpLiveTracked('empty')).toBe(false);
  });

  it('clears the active map without erasing persisted storage', () => {
    loadLiveTrackedScores(TOURNAMENT_A);
    recordLiveTrackedScore('m1');
    clearActiveLiveTrackedScores();
    expect(isMatchUpLiveTracked('m1')).toBe(false);

    // localStorage still has m1; reloading the tournament restores it.
    expect(Object.keys(JSON.parse(storage.getItem(STORAGE_KEY_A)!))).toEqual(['m1']);
    loadLiveTrackedScores(TOURNAMENT_A);
    expect(isMatchUpLiveTracked('m1')).toBe(true);
  });
  describe('last live score', () => {
    const frame = {
      matchUpId: 'm1',
      score: { sets: [{ setNumber: 1, side1Score: 3, side2Score: 2, side1PointScore: '30', side2PointScore: '15' }] },
      matchUpStatus: 'IN_PROGRESS',
    };

    it('keeps the score a frame carried', () => {
      loadLiveTrackedScores(TOURNAMENT_A);
      recordLiveTrackedScore('m1', frame);
      const entry = getLiveTrackedScore('m1');
      expect(entry?.score?.sets).toEqual(frame.score.sets);
      expect(entry?.matchUpStatus).toBe('IN_PROGRESS');
    });

    it('keeps the previous score when a later frame carries none (a clock-only update)', () => {
      loadLiveTrackedScores(TOURNAMENT_A);
      recordLiveTrackedScore('m1', frame);
      recordLiveTrackedScore('m1', { matchUpId: 'm1', boltTimerRemainingMs: 1000 });
      expect(getLiveTrackedScore('m1')?.score?.sets).toEqual(frame.score.sets);
    });

    it('replaces the score with the newer frame', () => {
      loadLiveTrackedScores(TOURNAMENT_A);
      recordLiveTrackedScore('m1', frame);
      recordLiveTrackedScore('m1', { score: { sets: [{ setNumber: 1, side1Score: 4, side2Score: 2 }] } });
      expect(getLiveTrackedScore('m1')?.score?.sets).toEqual([{ setNumber: 1, side1Score: 4, side2Score: 2 }]);
    });

    it('drops fields a display does not need and values of the wrong type', () => {
      loadLiveTrackedScores(TOURNAMENT_A);
      recordLiveTrackedScore('m1', {
        score: { sets: [{ setNumber: 1, side1Score: 2, side2Score: '<img>', injected: 'x' }], scoreStringSide1: 7 },
      });
      expect(getLiveTrackedScore('m1')?.score).toEqual({ sets: [{ setNumber: 1, side1Score: 2 }] });
    });

    it('persists the score and restores it on reload', () => {
      loadLiveTrackedScores(TOURNAMENT_A);
      recordLiveTrackedScore('m1', frame);
      clearActiveLiveTrackedScores();
      loadLiveTrackedScores(TOURNAMENT_A);
      expect(getLiveTrackedScore('m1')?.score?.sets).toEqual(frame.score.sets);
    });
  });
});
