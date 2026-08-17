import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('i18n', () => ({ t: (key: string) => key }));

// `vi.mock` factories are hoisted above module-level consts, so the shared
// filter state has to come from `vi.hoisted` rather than a plain const.
const { matchUpFilters, participantFilters } = vi.hoisted(() => ({
  matchUpFilters: {} as Record<string, any>,
  participantFilters: {} as Record<string, any>,
}));
vi.mock('services/context', () => ({ context: { matchUpFilters, participantFilters } }));

import { getMatchUpStatusFilter } from './matchUpStatusFilter';
import { getSexFilter } from './sexFilter';

/**
 * Tabulator warns `Filter Error - No matching filter type found, ignoring: undefined`
 * whenever `removeFilter` is handed a filter that is not in its list — and every
 * one of these modules used to call `removeFilter` unconditionally at the top of
 * its update function, so the FIRST interaction on a page with no saved filter
 * always warned. (`undefined` is the message's `filter.type`, which is undefined
 * for a function filter — the value in the console said nothing about which
 * filter it was, which is why this went unexplained for so long.)
 *
 * These tests drive the real modules through a fake table so the guard is pinned
 * by behaviour rather than by reading the source.
 */

function fakeTable() {
  const added: any[] = [];
  const removed: any[] = [];
  return {
    addFilter: vi.fn((fn: any) => added.push(fn)),
    removeFilter: vi.fn((fn: any) => removed.push(fn)),
    added,
    removed,
  };
}

describe('filter modules do not remove a filter they never added', () => {
  beforeEach(() => {
    for (const key of Object.keys(matchUpFilters)) delete matchUpFilters[key];
    for (const key of Object.keys(participantFilters)) delete participantFilters[key];
  });

  describe('matchUpStatusFilter', () => {
    it('clearing with nothing applied does not call removeFilter', () => {
      const table = fakeTable();
      const { setStatus } = getMatchUpStatusFilter(table as any);

      setStatus(undefined);

      expect(table.removeFilter).not.toHaveBeenCalled();
      expect(table.addFilter).not.toHaveBeenCalled();
    });

    it('setting a status adds exactly one filter and removes none', () => {
      const table = fakeTable();
      const { setStatus } = getMatchUpStatusFilter(table as any);

      setStatus('complete');

      expect(table.addFilter).toHaveBeenCalledTimes(1);
      expect(table.removeFilter).not.toHaveBeenCalled();
    });

    it('changing an applied status removes the old filter before adding — Tabulator re-runs on both', () => {
      const table = fakeTable();
      const { setStatus } = getMatchUpStatusFilter(table as any);

      setStatus('complete');
      setStatus('retired');

      expect(table.removeFilter).toHaveBeenCalledTimes(1);
      expect(table.addFilter).toHaveBeenCalledTimes(2);
      // The same predicate instance goes in and out, which is what lets
      // Tabulator match it in its filter list.
      expect(table.removed[0]).toBe(table.added[0]);
    });

    it('clearing an applied status removes it and adds nothing', () => {
      const table = fakeTable();
      const { setStatus } = getMatchUpStatusFilter(table as any);

      setStatus('complete');
      setStatus(undefined);

      expect(table.removeFilter).toHaveBeenCalledTimes(1);
      expect(table.addFilter).toHaveBeenCalledTimes(1);
    });

    it('clearing twice does not remove twice', () => {
      const table = fakeTable();
      const { setStatus } = getMatchUpStatusFilter(table as any);

      setStatus('complete');
      setStatus(undefined);
      setStatus(undefined);

      expect(table.removeFilter).toHaveBeenCalledTimes(1);
    });

    it('a filter restored from saved state is treated as applied, so the first clear removes it', () => {
      matchUpFilters.status = 'complete';
      const table = fakeTable();
      const { setStatus } = getMatchUpStatusFilter(table as any);

      // Restoration applies the filter up front...
      expect(table.addFilter).toHaveBeenCalledTimes(1);
      setStatus(undefined);
      // ...so clearing it must remove it — the guard must not suppress this.
      expect(table.removeFilter).toHaveBeenCalledTimes(1);
    });
  });

  describe('sexFilter (participant tables share the pattern)', () => {
    // No setter is exposed; the filter is driven by its option onClick handlers.
    // `sexOptions[0]` is the "all" option, which clears.
    const clearAndPick = (table: any) => {
      const { sexOptions } = getSexFilter(table, undefined as any) as any;
      const options = sexOptions.filter((o: any) => !o.divider);
      return { clear: () => options[0].onClick(), pick: () => options[1].onClick() };
    };

    it('clearing with nothing applied does not call removeFilter', () => {
      const table = fakeTable();
      clearAndPick(table).clear();
      expect(table.removeFilter).not.toHaveBeenCalled();
    });

    it('still removes once a filter has been applied', () => {
      const table = fakeTable();
      const { clear, pick } = clearAndPick(table);
      pick();
      clear();
      expect(table.removeFilter).toHaveBeenCalledTimes(1);
    });
  });
});
