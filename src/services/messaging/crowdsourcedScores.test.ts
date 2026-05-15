/**
 * Unit tests for crowdsourcedScores — the persistent badge state behind
 * the "score was reported via the live tracker" indicator. Covers basic
 * mark/read, persistence, rehydration, per-tournament isolation, the
 * 24-hour TTL, and the completion-driven prune.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _resetCrowdsourcedScoresForTest,
  clearActiveCrowdsourcedScores,
  isMatchUpCrowdsourced,
  loadCrowdsourcedScores,
  markMatchUpCrowdsourced,
  pruneCompletedMatchUps,
} from './crowdsourcedScores';

const TOURNAMENT_A = 'tournament-a';
const TOURNAMENT_B = 'tournament-b';
const STORAGE_KEY_A = `crowdsourcedScores:${TOURNAMENT_A}`;
const STORAGE_KEY_B = `crowdsourcedScores:${TOURNAMENT_B}`;

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
  _resetCrowdsourcedScoresForTest();
});

afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as any).localStorage;
});

describe('crowdsourcedScores', () => {
  it('marks a matchUp and reports it as crowdsourced', () => {
    loadCrowdsourcedScores(TOURNAMENT_A);
    markMatchUpCrowdsourced('m1');
    expect(isMatchUpCrowdsourced('m1')).toBe(true);
    expect(isMatchUpCrowdsourced('m2')).toBe(false);
  });

  it('persists each mark to localStorage with a lastSeenAt timestamp', () => {
    loadCrowdsourcedScores(TOURNAMENT_A);
    markMatchUpCrowdsourced('m1');
    markMatchUpCrowdsourced('m2');
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY_A)!);
    expect(Object.keys(parsed).sort()).toEqual(['m1', 'm2']);
    expect(typeof parsed.m1.lastSeenAt).toBe('string');
    expect(typeof parsed.m2.lastSeenAt).toBe('string');
  });

  it('refreshes lastSeenAt on a repeat mark so the 24h countdown rolls forward', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T10:00:00Z'));
    loadCrowdsourcedScores(TOURNAMENT_A);
    markMatchUpCrowdsourced('m1');
    const firstTimestamp = JSON.parse(storage.getItem(STORAGE_KEY_A)!).m1.lastSeenAt;

    vi.setSystemTime(new Date('2026-05-15T20:00:00Z'));
    markMatchUpCrowdsourced('m1');
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
    loadCrowdsourcedScores(TOURNAMENT_A);
    expect(isMatchUpCrowdsourced('m1')).toBe(true);
    expect(isMatchUpCrowdsourced('m3')).toBe(true);
    expect(isMatchUpCrowdsourced('m2')).toBe(false);
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

    loadCrowdsourcedScores(TOURNAMENT_A);

    expect(isMatchUpCrowdsourced('recent')).toBe(true);
    expect(isMatchUpCrowdsourced('edge')).toBe(true);
    expect(isMatchUpCrowdsourced('stale')).toBe(false);

    // Persisted storage should reflect the prune.
    const remaining = JSON.parse(storage.getItem(STORAGE_KEY_A)!);
    expect(Object.keys(remaining).sort()).toEqual(['edge', 'recent']);
  });

  it('pruneCompletedMatchUps removes specified ids and persists', () => {
    loadCrowdsourcedScores(TOURNAMENT_A);
    markMatchUpCrowdsourced('m1');
    markMatchUpCrowdsourced('m2');
    markMatchUpCrowdsourced('m3');

    const removed = pruneCompletedMatchUps(['m1', 'm3']);

    expect(removed).toBe(2);
    expect(isMatchUpCrowdsourced('m1')).toBe(false);
    expect(isMatchUpCrowdsourced('m2')).toBe(true);
    expect(isMatchUpCrowdsourced('m3')).toBe(false);

    const persisted = JSON.parse(storage.getItem(STORAGE_KEY_A)!);
    expect(Object.keys(persisted)).toEqual(['m2']);
  });

  it('pruneCompletedMatchUps removes the localStorage key entirely when the map empties', () => {
    loadCrowdsourcedScores(TOURNAMENT_A);
    markMatchUpCrowdsourced('m1');
    pruneCompletedMatchUps(['m1']);
    expect(storage.getItem(STORAGE_KEY_A)).toBeNull();
  });

  it('pruneCompletedMatchUps is a no-op when nothing matches', () => {
    loadCrowdsourcedScores(TOURNAMENT_A);
    markMatchUpCrowdsourced('m1');
    const removed = pruneCompletedMatchUps(['unknown']);
    expect(removed).toBe(0);
    expect(isMatchUpCrowdsourced('m1')).toBe(true);
  });

  it('isolates entries per tournament', () => {
    loadCrowdsourcedScores(TOURNAMENT_A);
    markMatchUpCrowdsourced('m1');
    loadCrowdsourcedScores(TOURNAMENT_B);
    markMatchUpCrowdsourced('m2');

    expect(isMatchUpCrowdsourced('m1')).toBe(false);
    expect(isMatchUpCrowdsourced('m2')).toBe(true);

    expect(Object.keys(JSON.parse(storage.getItem(STORAGE_KEY_A)!))).toEqual(['m1']);
    expect(Object.keys(JSON.parse(storage.getItem(STORAGE_KEY_B)!))).toEqual(['m2']);
  });

  it('ignores marks before a tournament has been loaded', () => {
    markMatchUpCrowdsourced('m1');
    loadCrowdsourcedScores(TOURNAMENT_A);
    expect(isMatchUpCrowdsourced('m1')).toBe(false);
  });

  it('ignores falsy matchUpIds', () => {
    loadCrowdsourcedScores(TOURNAMENT_A);
    markMatchUpCrowdsourced(undefined);
    markMatchUpCrowdsourced('');
    expect(storage.getItem(STORAGE_KEY_A)).toBeNull();
    expect(isMatchUpCrowdsourced(undefined)).toBe(false);
    expect(isMatchUpCrowdsourced('')).toBe(false);
  });

  it('survives corrupt localStorage payloads by falling back to an empty map', () => {
    storage.setItem(STORAGE_KEY_A, 'not-json');
    loadCrowdsourcedScores(TOURNAMENT_A);
    expect(isMatchUpCrowdsourced('m1')).toBe(false);
    markMatchUpCrowdsourced('m1');
    expect(isMatchUpCrowdsourced('m1')).toBe(true);
  });

  it('rejects array-shaped payloads (legacy schema) on load', () => {
    storage.setItem(STORAGE_KEY_A, JSON.stringify(['m1', 'm2']));
    loadCrowdsourcedScores(TOURNAMENT_A);
    expect(isMatchUpCrowdsourced('m1')).toBe(false);
    expect(isMatchUpCrowdsourced('m2')).toBe(false);
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
    loadCrowdsourcedScores(TOURNAMENT_A);
    expect(isMatchUpCrowdsourced('good')).toBe(true);
    expect(isMatchUpCrowdsourced('bad')).toBe(false);
    expect(isMatchUpCrowdsourced('empty')).toBe(false);
  });

  it('clears the active map without erasing persisted storage', () => {
    loadCrowdsourcedScores(TOURNAMENT_A);
    markMatchUpCrowdsourced('m1');
    clearActiveCrowdsourcedScores();
    expect(isMatchUpCrowdsourced('m1')).toBe(false);

    // localStorage still has m1; reloading the tournament restores it.
    expect(Object.keys(JSON.parse(storage.getItem(STORAGE_KEY_A)!))).toEqual(['m1']);
    loadCrowdsourcedScores(TOURNAMENT_A);
    expect(isMatchUpCrowdsourced('m1')).toBe(true);
  });
});
