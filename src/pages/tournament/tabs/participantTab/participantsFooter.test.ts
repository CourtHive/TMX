import { createChipFilter } from 'components/tables/common/filters/chipFilter';
import { rowsPassingOthers } from 'components/tables/common/filters/rowsPassingOthers';
import { paintCounts, presentValues, type FacetGroup } from './participantsFooter';
import { describe, expect, it } from 'vitest';

function fakeTable(rows: any[]) {
  const filters: any[] = [];
  let selected: any[] = [];
  return {
    rows,
    getData: () => rows,
    getFilters: () => filters.map((field) => ({ field })),
    addFilter: (fn: any) => filters.push(fn),
    removeFilter: (fn: any) => filters.splice(filters.indexOf(fn), 1),
    getSelectedData: () => selected,
    select: (next: any[]) => (selected = next),
  };
}

function group(
  table: any,
  key: string,
  values: string[],
  matches: FacetGroup['matches'],
  valuesOf?: FacetGroup['valuesOf'],
) {
  const filter = createChipFilter({ table, values, matches, persist: () => {} });
  return { key, label: key, options: values.map((value) => ({ value, label: value })), filter, matches, valuesOf };
}

/** The counting the footer shipped with: per group, re-filter every row through every other filter. */
function reference(table: any, groups: FacetGroup[]) {
  const selected = table.getSelectedData();
  return new Map(
    groups.map((g) => {
      const rows = selected.length ? selected : rowsPassingOthers(table, g.filter.rowFilter);
      return [
        g,
        Object.fromEntries(g.options.map(({ value }) => [value, rows.filter((r: any) => g.matches(r, value)).length])),
      ];
    }),
  );
}

// a small deterministic generator, so a failure reproduces
function prng(seed: number) {
  return () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
}

describe('paintCounts', () => {
  it('counts exactly what per-group re-filtering counts, across filter and selection states', () => {
    const random = prng(7);
    const rows = Array.from({ length: 400 }, (_, i) => ({
      id: i,
      x: random() < 0.5 ? 'a' : 'b',
      y: random() < 0.3 ? 'c' : 'd',
      tags: ['p', 'q', 'r'].filter(() => random() < 0.4),
      text: random() < 0.8 ? 'keep' : 'drop',
    }));
    const table = fakeTable(rows);
    const groups = [
      group(table, 'x', ['a', 'b'], (r, v) => r.x === v),
      group(table, 'y', ['c', 'd'], (r, v) => r.y === v),
      // a multi-valued group counted through valuesOf; matches must agree with it
      group(
        table,
        'tags',
        ['p', 'q', 'r'],
        (r, v) => r.tags.includes(v),
        (r) => r.tags,
      ),
    ] as FacetGroup[];
    const search = (r: any) => r.text === 'keep';

    for (let trial = 0; trial < 200; trial++) {
      for (const g of groups)
        if (random() < 0.4) g.filter.toggle(g.options[Math.floor(random() * g.options.length)].value);
      const searching = table.getFilters().some(({ field }: any) => field === search);
      if (random() < 0.3) {
        if (searching) table.removeFilter(search);
        else table.addFilter(search);
      }
      table.select(random() < 0.2 ? rows.filter(() => random() < 0.1) : []);
      expect(paintCounts(table, groups), `trial ${trial}`).toEqual(reference(table, groups));
    }
  });
});

describe('presentValues', () => {
  it('sees a value as soon as a row with it is in the table, whichever route added it', () => {
    const rows: any[] = [{ tags: ['p'] }];
    const table = fakeTable(rows);
    const tags = {
      ...group(
        table,
        'tags',
        ['p', 'q'],
        (r, v) => r.tags.includes(v),
        (r) => r.tags,
      ),
      hideWhenEmpty: new Set(['p', 'q']),
    } as FacetGroup;
    expect([...(presentValues(table, [tags]).get(tags) ?? [])]).toEqual(['p']);
    rows.push({ tags: ['q'] }); // replaceData hands the table a new row, which a repaint reads
    expect([...(presentValues(table, [tags]).get(tags) ?? [])].sort()).toEqual(['p', 'q']);
  });
});
