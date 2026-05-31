import { beforeEach, describe, expect, it, vi } from 'vitest';

import { markRatingPromptDismissed, wasRatingPromptDismissed } from './ratingPromptStorage';

const KEY = 'tmx_rating_prompt_dismissed';

// Vitest runs in Node by default — stub a simple in-memory localStorage.
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

beforeEach(() => {
  for (const k of Object.keys(memStore)) delete memStore[k];
});

describe('ratingPromptStorage', () => {
  it('returns false when nothing has been stored', () => {
    expect(wasRatingPromptDismissed('t1', ['utr', 'wtn'])).toBe(false);
  });

  it('returns true after marking with the same scale set', () => {
    markRatingPromptDismissed('t1', ['utr', 'wtn']);
    expect(wasRatingPromptDismissed('t1', ['utr', 'wtn'])).toBe(true);
  });

  it('treats scale sets as order-insensitive', () => {
    markRatingPromptDismissed('t1', ['wtn', 'utr']);
    expect(wasRatingPromptDismissed('t1', ['utr', 'wtn'])).toBe(true);
  });

  it('treats scale sets as case-insensitive', () => {
    markRatingPromptDismissed('t1', ['UTR', 'WTN']);
    expect(wasRatingPromptDismissed('t1', ['utr', 'wtn'])).toBe(true);
    expect(wasRatingPromptDismissed('t1', ['UTR', 'WTN'])).toBe(true);
  });

  it('re-prompts when a scale is added to the tournament', () => {
    markRatingPromptDismissed('t1', ['utr', 'wtn']);
    expect(wasRatingPromptDismissed('t1', ['utr', 'wtn', 'ntrp'])).toBe(false);
  });

  it('re-prompts when a scale is removed from the tournament', () => {
    markRatingPromptDismissed('t1', ['utr', 'wtn']);
    expect(wasRatingPromptDismissed('t1', ['utr'])).toBe(false);
  });

  it('scopes per tournament', () => {
    markRatingPromptDismissed('t1', ['utr']);
    expect(wasRatingPromptDismissed('t2', ['utr'])).toBe(false);
  });

  it('overwrites the stored set when called again with a different set', () => {
    markRatingPromptDismissed('t1', ['utr', 'wtn']);
    markRatingPromptDismissed('t1', ['ntrp']);
    expect(wasRatingPromptDismissed('t1', ['utr', 'wtn'])).toBe(false);
    expect(wasRatingPromptDismissed('t1', ['ntrp'])).toBe(true);
  });

  it('ignores legacy `{tournamentId: true}` entries (re-prompts once after upgrade)', () => {
    memStore[KEY] = JSON.stringify({ t1: true });
    expect(wasRatingPromptDismissed('t1', ['utr', 'wtn'])).toBe(false);
  });

  it('tolerates garbage in localStorage', () => {
    memStore[KEY] = 'not json';
    expect(wasRatingPromptDismissed('t1', ['utr'])).toBe(false);
    markRatingPromptDismissed('t1', ['utr']);
    expect(wasRatingPromptDismissed('t1', ['utr'])).toBe(true);
  });

  it('is a no-op when tournamentId is empty', () => {
    markRatingPromptDismissed('', ['utr']);
    expect(wasRatingPromptDismissed('', ['utr'])).toBe(false);
  });
});
