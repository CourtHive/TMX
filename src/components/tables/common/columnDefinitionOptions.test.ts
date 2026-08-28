import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';

vi.mock('i18n', () => ({ t: (key: string) => key }));
vi.mock('services/context', () => ({ context: { columns: {} } }));
// `courthive-components` touches `document` at import time (vanillajs-datepicker
// calls `document.createRange()` at module scope) and the unit suite runs in node.
// Nothing it provides is called here — formatters and editors are values in a
// definition, never invoked — so any export can stand in as a no-op.
vi.mock('courthive-components', () => ({ renderParticipant: vi.fn() }));

import { LOCK_VISIBLE_CLASS, applyColumnVisibility, isLockedVisible } from './columnIsVisible';
import { getUnifiedColumns } from '../eventsTable/unified/unifiedColumns';
import { context } from 'services/context';

/**
 * Tabulator validates every key in a column definition against its own option
 * list and warns on the console for anything it does not recognise:
 *
 *   Invalid column definition option: lockVisible
 *
 * It does not throw, and it does not drop the value — so a bespoke key works
 * perfectly while producing a warning on every render, in production, forever.
 * That is exactly how `lockVisible` survived: the feature was fine, only the
 * console was wrong, so nothing ever forced the issue.
 *
 * The accepted set is read from the INSTALLED Tabulator rather than hard-coded,
 * so bumping the dependency re-derives it instead of silently vindicating a key
 * the new version no longer takes.
 */
function acceptedColumnOptions(): Set<string> {
  const require = createRequire(import.meta.url);
  const dist = require.resolve('tabulator-tables/dist/js/tabulator_esm.js');
  const source = fs.readFileSync(dist, 'utf8');

  // Base defaults, then every option the modules register onto the same list.
  const base = source.match(/var defaultColumnOptions = \{([\s\S]*?)\n\};/);
  if (!base) throw new Error('could not locate defaultColumnOptions in the installed Tabulator');
  const keys = [...base[1].matchAll(/"([A-Za-z0-9_]+)":/g)].map((m) => m[1]);
  const registered = [...source.matchAll(/registerColumnOption\(\s*["']([A-Za-z0-9_]+)["']/g)].map((m) => m[1]);

  return new Set([...keys, ...registered]);
}

function collectKeys(columns: any[], into = new Set<string>()): Set<string> {
  for (const column of columns) {
    for (const key of Object.keys(column)) into.add(key);
    if (Array.isArray(column.columns)) collectKeys(column.columns, into);
  }
  return into;
}

const entries = [
  {
    participant: { participantId: 'p1', participantName: 'Antelopes', teams: [{ teamId: 't1' }] },
    participantId: 'p1',
    drawPosition: 1,
    seedNumber: 1,
    ranking: 4,
  },
];

describe('Tabulator column definition options', () => {
  it('derives a non-trivial accepted set from the installed Tabulator', () => {
    // The control. A failed regex would yield an empty set, and every
    // assertion below would then pass by matching nothing.
    const accepted = acceptedColumnOptions();
    expect(accepted.size).toBeGreaterThan(100);
    expect(accepted.has('cssClass')).toBe(true);
    expect(accepted.has('lockVisible'), 'the key that caused this test to exist').toBe(false);
  });

  it('the unified entries columns use only options Tabulator accepts', () => {
    const accepted = acceptedColumnOptions();
    const columns = getUnifiedColumns({ entries, hasDrawDefinitions: true, sortState: undefined } as any);

    expect(columns.length, 'a builder returning nothing would pass vacuously').toBeGreaterThan(5);

    const used = [...collectKeys(columns)];
    expect(used.length).toBeGreaterThan(10);
    expect(used.filter((key) => !accepted.has(key))).toEqual([]);
  });
});

describe('locked columns', () => {
  it('recognises the marker, and only the marker', () => {
    expect(isLockedVisible({ cssClass: LOCK_VISIBLE_CLASS })).toBe(true);
    // Must survive being combined with real styling classes.
    expect(isLockedVisible({ cssClass: `tmx-numeric ${LOCK_VISIBLE_CLASS}` })).toBe(true);
    expect(isLockedVisible({ cssClass: 'tmx-numeric' })).toBe(false);
    // A prefix match would wrongly lock any class sharing the stem.
    expect(isLockedVisible({ cssClass: `${LOCK_VISIBLE_CLASS}-header` })).toBe(false);
    expect(isLockedVisible({})).toBe(false);
    expect(isLockedVisible(undefined)).toBe(false);
  });

  it('the entries table still locks the Grouping and name columns', () => {
    const columns = getUnifiedColumns({ entries, hasDrawDefinitions: true, sortState: undefined } as any);
    const locked = columns.filter(isLockedVisible).map((column: any) => column.field);
    expect(locked).toEqual(['segment', 'participant']);
  });

  it('saved visibility never hides a locked column', () => {
    const columns: any[] = [
      { title: 'Grouping', field: 'segment', cssClass: LOCK_VISIBLE_CLASS, visible: true },
      { title: 'Ranking', field: 'ranking', visible: true },
    ];
    // Both fields are marked hidden in saved state; only the unlocked one may yield.
    (context as any).columns = { segment: false, ranking: false };

    applyColumnVisibility(columns);

    expect(columns[0].visible, 'a locked column ignores saved state').toBe(true);
    expect(columns[1].visible, 'the control — an ordinary column obeys it').toBe(false);
  });
});
