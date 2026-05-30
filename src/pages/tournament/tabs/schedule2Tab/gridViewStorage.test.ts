import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readScheduledFilters,
  readScheduledGroupBy,
  readScheduledSearch,
  readSidebarTab,
  writeScheduledFilters,
  writeScheduledGroupBy,
  writeScheduledSearch,
  writeSidebarTab,
} from './gridViewStorage';

// Vitest's node environment has no `localStorage`, so each test stubs an
// in-memory shim. Failing reads / writes are simulated by replacing the
// stub with one whose methods throw — exercises the catch branches in the
// adapters.
function installMemoryStorage(): void {
  const store: Record<string, string> = {};
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  });
}

function installThrowingStorage(): void {
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
    removeItem: () => {
      throw new Error('blocked');
    },
    clear: () => {
      throw new Error('blocked');
    },
    key: () => {
      throw new Error('blocked');
    },
    get length() {
      return 0;
    },
  });
}

beforeEach(() => installMemoryStorage());
afterEach(() => vi.unstubAllGlobals());

// ── sidebar tab ──

describe('sidebar tab', () => {
  it('defaults to `unscheduled` when nothing is persisted', () => {
    expect(readSidebarTab()).toBe('unscheduled');
  });

  it('round-trips both tab values', () => {
    writeSidebarTab('scheduled');
    expect(readSidebarTab()).toBe('scheduled');
    writeSidebarTab('unscheduled');
    expect(readSidebarTab()).toBe('unscheduled');
  });

  it('falls back to `unscheduled` when storage throws', () => {
    installThrowingStorage();
    expect(readSidebarTab()).toBe('unscheduled');
    // write should swallow the throw rather than propagate it
    expect(() => writeSidebarTab('scheduled')).not.toThrow();
  });
});

// ── scheduled search ──

describe('scheduled search', () => {
  it('returns empty string when nothing is persisted', () => {
    expect(readScheduledSearch()).toBe('');
  });

  it('round-trips a non-empty query', () => {
    writeScheduledSearch('Alice');
    expect(readScheduledSearch()).toBe('Alice');
  });

  it('removes the key entirely when the query is empty', () => {
    writeScheduledSearch('Alice');
    expect(localStorage.getItem('schedule2:scheduled-search')).toBe('Alice');
    writeScheduledSearch('');
    expect(localStorage.getItem('schedule2:scheduled-search')).toBeNull();
  });
});

// ── scheduled group-by ──

describe('scheduled group-by', () => {
  it('defaults to `event` when nothing is persisted', () => {
    expect(readScheduledGroupBy()).toBe('event');
  });

  it('round-trips every valid group-by value', () => {
    for (const v of ['event', 'draw', 'round', 'structure'] as const) {
      writeScheduledGroupBy(v);
      expect(readScheduledGroupBy()).toBe(v);
    }
  });

  it('falls back to `event` when the stored value is invalid', () => {
    localStorage.setItem('schedule2:scheduled-groupby', 'cosmic');
    expect(readScheduledGroupBy()).toBe('event');
  });
});

// ── scheduled filters ──

const FILTERS_KEY = 'schedule2:scheduled-filters';

describe('scheduled filters', () => {
  it('returns an empty object when nothing is persisted', () => {
    expect(readScheduledFilters()).toEqual({});
  });

  it('round-trips a populated CatalogFilters object', () => {
    const filters = { eventType: 'SINGLES', gender: 'MALE' };
    writeScheduledFilters(filters);
    expect(readScheduledFilters()).toEqual(filters);
  });

  it('removes the key when every filter dimension is empty', () => {
    writeScheduledFilters({ eventType: 'SINGLES' });
    expect(localStorage.getItem(FILTERS_KEY)).not.toBeNull();
    writeScheduledFilters({});
    expect(localStorage.getItem(FILTERS_KEY)).toBeNull();
  });

  it('returns an empty object when stored JSON is malformed', () => {
    localStorage.setItem(FILTERS_KEY, 'not-json');
    expect(readScheduledFilters()).toEqual({});
  });
});
