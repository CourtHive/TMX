import { describe, expect, it } from 'vitest';

import { dominantCourtNameBase, nextCourtNames, summariseCourtNames } from './courtNaming';

const courts = (...names: string[]) => names.map((courtName) => ({ courtName }));

/**
 * Regression cover for the duplicate-name defect seen in production on 2026-08-23 (CFS audit_log,
 * tournament 6c637f87 — J300 College Park). The engine numbers generated courts from 1 on every
 * call, so adding to a populated venue reissued names that were already in use; the operator
 * absorbed it by renaming both new courts by hand seconds later.
 */
describe('nextCourtNames', () => {
  it('continues the venue numbering instead of restarting at 1', () => {
    const existing = courts('Court 1', 'Court 2', 'Court 3');
    expect(nextCourtNames({ courts: existing, count: 2 })).toEqual(['Court 4', 'Court 5']);
  });

  it('handles the venue shape that actually failed — numbered courts plus an odd show court', () => {
    // "Center (17)" has no trailing number, so `deriveCourtNameBase` finds no unanimous base and
    // answers '' — which is exactly what dropped the naming back to a duplicate "Court 1".
    const existing = courts('Court 13', 'Court 14', 'Court 15', 'Center (17)', 'Court 18', 'Court 19');
    expect(nextCourtNames({ courts: existing, count: 2 })).toEqual(['Court 20', 'Court 21']);
  });

  it('counts from the highest index, not the court count, so a deleted court is not reissued', () => {
    // A name still referenced by a scheduled matchUp must not come back on a different court.
    const existing = courts('Court 1', 'Court 5');
    expect(nextCourtNames({ courts: existing, count: 1 })).toEqual(['Court 6']);
  });

  it('starts at 1 for an empty venue', () => {
    expect(nextCourtNames({ courts: [], count: 3 })).toEqual(['Court 1', 'Court 2', 'Court 3']);
    expect(nextCourtNames({ count: 1 })).toEqual(['Court 1']);
  });

  it('respects a venue convention that is not "Court"', () => {
    const existing = courts('Pista 1', 'Pista 2', 'Central');
    expect(nextCourtNames({ courts: existing, count: 2 })).toEqual(['Pista 3', 'Pista 4']);
  });

  it('honours an explicit base over the derived one', () => {
    const existing = courts('Court 1', 'Court 2');
    expect(nextCourtNames({ courts: existing, count: 1, base: 'Show Court' })).toEqual(['Show Court 1']);
  });

  it('never returns a name the venue already uses', () => {
    // Counting from max + 1 is what guarantees this; the explicit skip in `nextCourtNames` only
    // keeps the invariant true if that rule is ever changed. 'Court 7 Annex' carries no trailing
    // number, so it neither raises the count nor blocks the plain 'Court 7'.
    const existing = courts('Court 1', 'Court 2', 'Court 4', 'Court 7 Annex', 'Centre');
    const names = nextCourtNames({ courts: existing, count: 3 });
    expect(names).toEqual(['Court 5', 'Court 6', 'Court 7']);

    const taken = existing.map((c) => c.courtName);
    for (const name of names) expect(taken).not.toContain(name);
  });

  it('tolerates malformed court entries', () => {
    const existing = [{ courtName: 'Court 1' }, {}, { courtName: '' }, null] as any[];
    expect(nextCourtNames({ courts: existing, count: 1 })).toEqual(['Court 2']);
  });

  it('returns nothing for a non-positive or fractional count', () => {
    expect(nextCourtNames({ courts: [], count: 0 })).toEqual([]);
    expect(nextCourtNames({ courts: [], count: -2 })).toEqual([]);
    expect(nextCourtNames({ courts: [], count: 1.5 })).toEqual([]);
  });
});

describe('dominantCourtNameBase', () => {
  it('picks the convention most courts follow rather than requiring unanimity', () => {
    expect(dominantCourtNameBase(courts('Court 1', 'Court 2', 'Show Court 1'))).toBe('Court');
  });

  it('is undefined when no court carries a numbered name', () => {
    expect(dominantCourtNameBase(courts('Centre', 'Grandstand'))).toBeUndefined();
    expect(dominantCourtNameBase([])).toBeUndefined();
  });

  it('resolves ties alphabetically so court order cannot change the answer', () => {
    const forward = dominantCourtNameBase(courts('Alpha 1', 'Beta 1'));
    const reverse = dominantCourtNameBase(courts('Beta 1', 'Alpha 1'));
    expect(forward).toBe('Alpha');
    expect(reverse).toBe(forward);
  });
});

describe('summariseCourtNames', () => {
  it('lists a short set in full', () => {
    expect(summariseCourtNames(['Court 1', 'Court 2'])).toBe('Court 1, Court 2');
  });

  it('elides the middle of a long set but keeps the last name', () => {
    const names = ['Court 1', 'Court 2', 'Court 3', 'Court 4', 'Court 5', 'Court 6'];
    expect(summariseCourtNames(names)).toBe('Court 1, Court 2, Court 3, … Court 6');
  });
});
