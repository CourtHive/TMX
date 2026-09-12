import { cellMatchesSearch, cellSearchText, searchNormalize } from './gridSearchMatch';
import { describe, expect, it } from 'vitest';

/**
 * The unit suite runs in node with no jsdom, and `gridSearchMatch` reads only the
 * node it is handed, so a literal tree stands in for the rendered cell. The shape
 * below is the real court-grid cell — copied from a rendered grid, double space
 * in the stored name and all, since that space is the whole point.
 */
const LIVSON = 'Michael Livson';
const LIVSON_NORMALIZED = 'michael livson';
const LIVSON_DOUBLE_SPACED = 'Michael  Livson';
const CHEN = 'Tin Chen';

const text = (value: string): any => ({ nodeType: 3, nodeValue: value, childNodes: [] });
const el = (...childNodes: any[]): any => ({ nodeType: 1, nodeValue: null, childNodes });

function gridCell(sideOne: string, sideTwo: string, roundLabel = "Men's Singles R32"): any {
  return el(
    el(el(text('13:30'))), // header > time
    el(
      el(text(roundLabel)), // event-round
      el(
        el(el(text(sideOne))), // side > name
        el(text('vs.')),
        el(el(text(sideTwo))),
      ),
    ),
    el(), // empty footer
  );
}

describe('searchNormalize', () => {
  it('collapses whitespace runs, trims, and lower-cases', () => {
    expect(searchNormalize('  Michael   Livson  ')).toBe(LIVSON_NORMALIZED);
    expect(searchNormalize('Michael\tLivson')).toBe(LIVSON_NORMALIZED);
    expect(searchNormalize('Michael\nLivson')).toBe(LIVSON_NORMALIZED);
  });

  it('reports an all-whitespace query as empty so the caller can decline it', () => {
    expect(searchNormalize('   ')).toBe('');
    expect(searchNormalize('')).toBe('');
  });
});

describe('cellSearchText', () => {
  it('separates adjacent elements rather than gluing them together', () => {
    // `textContent` alone produced "13:30Men's Singles R32Michael Livsonvs.Tin Chen".
    expect(cellSearchText(gridCell(LIVSON, CHEN))).toBe("13:30 men's singles r32 michael livson vs. tin chen");
  });

  it('collapses a double space stored inside a participant name', () => {
    expect(cellSearchText(gridCell(LIVSON_DOUBLE_SPACED, CHEN))).toContain(LIVSON_NORMALIZED);
  });
});

describe('cellMatchesSearch', () => {
  it("matches a stored 'Michael  Livson' against the 'Michael Livson' on screen", () => {
    // The reported bug exactly: 'Michael' matched the cell and 'Michael Livson' did not.
    const cell = gridCell(LIVSON_DOUBLE_SPACED, CHEN);
    expect(cellMatchesSearch(cell, 'Michael')).toBe(true);
    expect(cellMatchesSearch(cell, LIVSON)).toBe(true);
  });

  it('matches regardless of how the QUERY is spaced', () => {
    const cell = gridCell(LIVSON, CHEN);
    expect(cellMatchesSearch(cell, '  michael   livson ')).toBe(true);
  });

  it('matches across the element seam between the round label and the first name', () => {
    expect(cellMatchesSearch(gridCell(LIVSON, CHEN), 'R32 Michael')).toBe(true);
  });

  it('does not match a player who is not in the cell', () => {
    expect(cellMatchesSearch(gridCell(LIVSON_DOUBLE_SPACED, CHEN), 'Alice Rowan')).toBe(false);
  });

  it('never matches on an empty or whitespace-only query', () => {
    const cell = gridCell(LIVSON, CHEN);
    expect(cellMatchesSearch(cell, '')).toBe(false);
    expect(cellMatchesSearch(cell, '   ')).toBe(false);
  });
});
