import { resetScheduledCatalogFilters, readScheduledFilters, readScheduledSearch } from './gridViewStorage';
import { reconcileScheduledFilters, scheduledFilterSections } from './scheduledCatalogFilters';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CatalogMatchUpItem } from 'courthive-components';

const items = (values: Partial<CatalogMatchUpItem>[]): CatalogMatchUpItem[] => values as CatalogMatchUpItem[];

afterEach(() => vi.unstubAllGlobals());

describe('scheduled filter lifecycle', () => {
  it('retains valid selections across days and removes only dimensions absent on the new day', () => {
    const selected = { eventName: 'Singles', roundName: 'Quarterfinal', gender: 'MALE' };
    expect(
      reconcileScheduledFilters(selected, items([{ eventName: 'Singles', roundName: 'Semifinal', gender: 'MALE' }])),
    ).toEqual({ eventName: 'Singles', gender: 'MALE' });
  });

  it('removes selections invalidated by a rename, deletion, or an empty day', () => {
    expect(reconcileScheduledFilters({ eventName: 'Old name' }, items([{ eventName: 'New name' }]))).toEqual({});
    expect(reconcileScheduledFilters({ drawName: 'Deleted flight' }, [])).toEqual({});
  });

  it('preserves a zero-result combination when every dimension is independently available', () => {
    const selected = { eventName: 'Singles', gender: 'FEMALE' };
    expect(
      reconcileScheduledFilters(
        selected,
        items([
          { eventName: 'Singles', gender: 'MALE' },
          { eventName: 'Doubles', gender: 'FEMALE' },
        ]),
      ),
    ).toEqual(selected);
  });

  it('shows an active category with only one value and omits inactive single-value categories', () => {
    const sections = scheduledFilterSections(items([{ eventName: 'Singles', gender: 'MALE' }]), {
      eventName: 'Singles',
    });
    expect(sections).toEqual([{ key: 'eventName', labelKey: 'schedule.filterAllEvents', values: ['Singles'] }]);
  });

  it('keeps a missing active value inspectable until reconciliation runs', () => {
    const sections = scheduledFilterSections([], { roundName: 'Final' });
    expect(sections).toEqual([{ key: 'roundName', labelKey: 'schedule.filterAllRounds', values: ['Final'] }]);
  });

  it('clears filters and search on tournament load, preserving presentation preferences', () => {
    const stored = new Map([
      ['schedule2:scheduled-filters', JSON.stringify({ eventName: 'Previous tournament' })],
      ['schedule2:scheduled-search', 'Previous player'],
      ['schedule2:scheduled-groupby', 'round'],
    ]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      removeItem: (key: string) => stored.delete(key),
    });
    resetScheduledCatalogFilters();
    expect(readScheduledFilters()).toEqual({});
    expect(readScheduledSearch()).toBe('');
    expect(stored.get('schedule2:scheduled-groupby')).toBe('round');
  });

  it('can start a new tournament with browser storage blocked', () => {
    vi.stubGlobal('localStorage', {
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => resetScheduledCatalogFilters()).not.toThrow();
  });
});
