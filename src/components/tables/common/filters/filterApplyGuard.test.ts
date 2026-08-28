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
import { getTeamFilter } from './teamFilter';
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

/**
 * Models Tabulator's build lifecycle, because the filter modules now defer
 * restoration until `tableBuilt`. A fake that is permanently "built" would let a
 * regression back in silently; a fake that never builds would report the
 * deferred restore as a filter that never applies. So it does both, in
 * Tabulator's own order: `initialized` is set BEFORE `tableBuilt` dispatches.
 */
function fakeTable() {
  const added: any[] = [];
  const removed: any[] = [];
  const handlers: Record<string, any[]> = {};
  return {
    initialized: false,
    on: vi.fn((event: string, fn: any) => {
      handlers[event] = handlers[event] ?? [];
      handlers[event].push(fn);
    }),
    addFilter: vi.fn((fn: any) => added.push(fn)),
    removeFilter: vi.fn((fn: any) => removed.push(fn)),
    added,
    removed,
    build() {
      this.initialized = true;
      for (const fn of handlers.tableBuilt ?? []) fn();
    },
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
      table.build();

      // Restoration applies the filter...
      expect(table.addFilter).toHaveBeenCalledTimes(1);
      setStatus(undefined);
      // ...so clearing it must remove it — the guard must not suppress this.
      expect(table.removeFilter).toHaveBeenCalledTimes(1);
    });

    /**
     * Tabulator warns "Table Not Initialized - Calling the addFilter function
     * before the table is initialized" for every filter restored at construction
     * time, which is when these modules run. Deferring to `tableBuilt` clears
     * that, but only if the filter still arrives — hence the pair.
     */
    it('restoration waits for tableBuilt rather than filtering an unbuilt table', () => {
      matchUpFilters.status = 'complete';
      const table = fakeTable();
      getMatchUpStatusFilter(table as any);

      expect(table.addFilter, 'nothing may touch the table before it is built').not.toHaveBeenCalled();

      table.build();

      expect(table.addFilter, 'and the saved filter must still be applied').toHaveBeenCalledTimes(1);
    });

    it('a table that is already built restores immediately', () => {
      // Tabulator sets `initialized` before dispatching `tableBuilt`, so a module
      // constructed inside that window would never see the event fire. Without
      // the `initialized` branch this restores nothing and the saved filter is
      // silently lost.
      matchUpFilters.status = 'complete';
      const table = fakeTable();
      table.build();

      getMatchUpStatusFilter(table as any);

      expect(table.addFilter).toHaveBeenCalledTimes(1);
    });

    it('clearing before the table builds does not let the deferred restore resurrect the filter', () => {
      matchUpFilters.status = 'complete';
      const table = fakeTable();
      const { setStatus } = getMatchUpStatusFilter(table as any);

      setStatus(undefined);
      table.build();

      // The deferred callback re-checks the applied flag; without that it would
      // re-apply a filter the user had already cleared.
      expect(table.addFilter).not.toHaveBeenCalled();
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

  describe('activeIndex clamps a missing option to 0', () => {
    // Was `idx >= 0 ? idx : 0`, now `Math.max(idx, 0)` — identical for every
    // value `findIndex` can return (-1 or a valid index). Pinned so the clamp
    // survives, since an unclamped -1 would index the popover out of bounds.
    it('returns 0 when no filter is set', () => {
      const table = fakeTable();
      const { activeIndex } = getMatchUpStatusFilter(table as any);
      expect(activeIndex()).toBe(0);
    });

    it('returns 0 when the saved filter matches no option', () => {
      matchUpFilters.status = 'a-status-that-no-longer-exists';
      const table = fakeTable();
      const { activeIndex } = getMatchUpStatusFilter(table as any);
      expect(activeIndex()).toBe(0);
    });

    it('returns the option index when the filter does match', () => {
      const table = fakeTable();
      const { statusOptions, setStatus, activeIndex } = getMatchUpStatusFilter(table as any);
      const selectable = statusOptions.filter((o: any) => !o.divider);
      // Pick a real option's own value so the lookup can succeed.
      const target = selectable.find((o: any) => o.filterValue);
      setStatus(target.filterValue);
      expect(activeIndex()).toBe(selectable.indexOf(target));
      expect(activeIndex()).toBeGreaterThan(0);
    });
  });

  describe('teamFilter does not reorder the caller array', () => {
    it('sorts for display without mutating the supplied teamParticipants', () => {
      const table = fakeTable();
      const teamParticipants = [
        { participantId: 't2', participantName: 'Zebras' },
        { participantId: 't1', participantName: 'Antelopes' },
      ];
      const original = teamParticipants.map((t) => t.participantId);

      const { teamOptions } = getTeamFilter({ table: table as any, teamParticipants }) as any;

      // `teamParticipants` is a caller-supplied parameter; `sort` used to
      // reorder it in place, which is invisible here but corrupts whatever the
      // caller does with the array next.
      expect(teamParticipants.map((t) => t.participantId)).toEqual(original);
      // ...while the rendered options ARE sorted.
      const labels = teamOptions.filter((o: any) => !o.divider && o.filterValue).map((o: any) => o.filterValue);
      expect(labels[0]).toBe('t1');
    });

    it('tolerates a participant with no name — the comparator must stay total', () => {
      const table = fakeTable();
      const teamParticipants = [{ participantId: 't1', participantName: 'Antelopes' }, { participantId: 't2' }];
      expect(() => getTeamFilter({ table: table as any, teamParticipants })).not.toThrow();
    });
  });
});
