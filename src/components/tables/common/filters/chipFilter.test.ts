import { chipsFit, createChipFilter, createChoiceFilter } from './chipFilter';
import { describe, expect, it } from 'vitest';

/**
 * Chip filters (CA 2026-11-08): values OR together; every chip on and no chip on are both "no filter"; with every
 * chip on a click selects that chip alone; turning off the last chip that is on turns them all back on, so a chip
 * filter never empties the table.
 */
function fakeTable() {
  const filters = new Set<(row: any) => boolean>();
  return {
    filters,
    addFilter: (fn: any) => filters.add(fn),
    removeFilter: (fn: any) => {
      if (!filters.has(fn)) throw new Error('removed a filter that was never added');
      filters.delete(fn);
    },
    // built already: whenTableBuilt runs at once
    initialized: true,
    on: () => undefined,
    rows: (rows: any[]) => rows.filter((row) => [...filters].every((fn) => fn(row))),
  };
}

const ROWS = [{ type: 'S' }, { type: 'D' }, { type: 'T' }];

function setup(initial?: string[]) {
  const table = fakeTable();
  let saved: string[] | undefined = initial;
  const filter = createChipFilter({
    table,
    values: ['S', 'D', 'T'],
    matches: (row, value) => row.type === value,
    initial,
    persist: (selected) => (saved = selected),
  });
  return { table, filter, saved: () => saved };
}

describe('createChipFilter', () => {
  it('starts with every chip on and no filter', () => {
    const { table, filter } = setup();
    expect(['S', 'D', 'T'].every(filter.isOn)).toBe(true);
    expect(filter.isFiltered()).toBe(false);
    expect(table.filters.size).toBe(0);
  });

  it('with every chip on, a click selects that chip alone', () => {
    const { table, filter, saved } = setup();
    filter.toggle('D');
    expect(['S', 'D', 'T'].map(filter.isOn)).toEqual([false, true, false]);
    expect(saved()).toEqual(['D']);
    expect(table.rows(ROWS)).toEqual([{ type: 'D' }]);
  });

  it('after that, clicks toggle, and the values OR together', () => {
    const { table, filter, saved } = setup(['D']);
    filter.toggle('S');
    expect(saved()).toEqual(['D', 'S']);
    expect(table.rows(ROWS).map((row) => row.type)).toEqual(['S', 'D']);
    expect(table.filters.size).toBe(1);
    filter.toggle('D');
    expect(saved()).toEqual(['S']);
  });

  it('turning the last chip off turns them all back on', () => {
    const { table, filter, saved } = setup(['S']);
    filter.toggle('S');
    expect(filter.isFiltered()).toBe(false);
    expect(saved()).toBeUndefined();
    expect(table.filters.size).toBe(0);
  });

  it('turning the missing chip back on is every chip on: no filter', () => {
    const { table, filter } = setup(['S', 'D']);
    filter.toggle('T');
    expect(filter.isFiltered()).toBe(false);
    expect(table.filters.size).toBe(0);
  });

  it('a saved selection is restored, and unknown or complete selections are no filter', () => {
    expect(setup(['D']).table.rows(ROWS)).toEqual([{ type: 'D' }]);
    expect(setup(['X']).filter.isFiltered()).toBe(false);
    expect(setup(['S', 'D', 'T']).filter.isFiltered()).toBe(false);
  });

  it('set selects exactly those values; clear removes the filter', () => {
    const { table, filter } = setup();
    filter.set(['D']);
    expect(filter.selected()).toEqual(['D']);
    filter.clear();
    expect(filter.selected()).toBeUndefined();
    expect(table.filters.size).toBe(0);
  });
});

describe('chipsFit', () => {
  it('types and profiles fit; a week of dates does not', () => {
    expect(chipsFit(['Singles', 'Doubles', 'Team'])).toBe(true);
    expect(chipsFit(['Competitive', 'Routine', 'Decisive', 'Walkover / Defaulted'])).toBe(true);
    expect(chipsFit(['Today', 'Sat, Nov 7', 'Sun, Nov 8', 'Mon, Nov 9', 'Tue, Nov 10', 'Wed, Nov 11', 'No date'])).toBe(
      false,
    );
  });

  it('one label wider than a row never fits', () => {
    expect(chipsFit(['Battle of Boca FREE Men’s Doubles (Must Be in Singles)'])).toBe(false);
  });
});

describe('createChoiceFilter', () => {
  const ROWS2 = [{ eventId: 'a' }, { eventId: 'b' }, { eventId: 'c' }];
  const choice = (ids: string[]) => {
    const table = fakeTable();
    const filter = createChoiceFilter({
      table,
      items: ids.map((value) => ({ value, label: `Event ${value}` })),
      allLabel: 'All events',
      matches: (row, value) => row.eventId === value,
      persist: () => undefined,
    });
    return { table, filter };
  };

  it('two values: chips, and the dropdown alongside', () => {
    const { filter } = choice(['a', 'b']);
    expect(filter.chips?.options.map(({ value }) => value)).toEqual(['a', 'b']);
    expect(filter.options.filter((o: any) => !o.divider)).toHaveLength(3);
  });

  it('three or more values: the dropdown only', () => {
    expect(choice(['a', 'b', 'c']).filter.chips).toBeUndefined();
  });

  it('a dropdown choice selects one value, and the chips and the index agree', () => {
    const { table, filter } = choice(['a', 'b', 'c']);
    const option = filter.options.find((o: any) => o.filterValue === 'b');
    option.onClick();
    expect(table.rows(ROWS2)).toEqual([{ eventId: 'b' }]);
    expect(filter.activeIndex()).toBe(2);
    filter.options[0].onClick();
    expect(filter.isFiltered()).toBe(false);
    expect(filter.activeIndex()).toBe(0);
  });

  it('one value: nothing to choose', () => {
    expect(choice(['a']).filter.hasOptions).toBe(false);
  });
});
