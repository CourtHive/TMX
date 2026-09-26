/**
 * The rule that tells the court grid's copy of a cell from the active strip's.
 *
 * This is the whole reason the module exists, and it is a decision rather than a DOM
 * call, so it is unit-testable even though TMX runs vitest in the node environment —
 * a pair of stub elements standing in for the two copies is the entire fixture.
 *
 * The defect it pins was live in `gridActionBar.scrollToMatchUp`: a bare
 * `querySelector('.spl-grid-cell[data-matchup-id="…"]')` takes the FIRST match in
 * document order, and for any scheduled matchUp that is not complete that is the
 * strip's duplicate — a sticky band already in view. Clicking an issue therefore
 * scrolled nowhere and pulsed the wrong element. Journey 132 covers the rendered
 * article; these cover the rule, including the two fallbacks a journey cannot
 * conveniently construct.
 */
import { drawnFor, isGridCopy, preferredCellFor } from './scheduleCellLookup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const A = 'mu-a';
const B = 'mu-b';

/**
 * One element the page has drawn for a matchUp. Only the two members the rule reads —
 * a narrower stub than a document, and it fails loudly if the rule starts reading a third.
 */
function drawn({ isCell = false, inStrip = false } = {}) {
  return {
    matches: (selector: string) => selector === '.spl-grid-cell' && isCell,
    closest: (selector: string) => (selector === '.spl-active-strip' && inStrip ? {} : null),
  } as unknown as HTMLElement;
}

/** Stand in for the document: `byId` maps a matchUp id to the elements drawn for it. */
function stubDocument(byId: Record<string, HTMLElement[]>) {
  const querySelectorAll = vi.fn((selector: string) => {
    const id = /\[data-matchup-id="(.*)"\]/.exec(selector)?.[1] ?? '';
    return byId[id] ?? [];
  });
  vi.stubGlobal('document', { querySelectorAll });
  vi.stubGlobal('CSS', { escape: (value: string) => value });
  return querySelectorAll;
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('isGridCopy', () => {
  it('is true for a grid cell outside the strip', () => {
    expect(isGridCopy(drawn({ isCell: true }))).toBe(true);
  });

  it('is false for the strip copy, which carries the SAME cell class', () => {
    // The trap in one line: the strip copy passes a `.spl-grid-cell` check.
    const strip = drawn({ isCell: true, inStrip: true });
    expect(strip.matches('.spl-grid-cell')).toBe(true);
    expect(isGridCopy(strip)).toBe(false);
  });

  it('is false for a surface that is not a cell at all, such as a catalog card', () => {
    expect(isGridCopy(drawn())).toBe(false);
  });
});

describe('drawnFor', () => {
  it('queries by matchUp id across every surface, not scoped to the grid', () => {
    const querySelectorAll = stubDocument({ [A]: [drawn()] });
    expect(drawnFor(A)).toHaveLength(1);
    expect(querySelectorAll).toHaveBeenCalledWith(`[data-matchup-id="${A}"]`);
  });
});

describe('preferredCellFor', () => {
  it('returns the GRID copy when both copies are drawn', () => {
    // Strip first, as the document orders them — the defect in fixture form.
    const strip = drawn({ isCell: true, inStrip: true });
    const grid = drawn({ isCell: true });
    stubDocument({ [A]: [strip, grid] });

    expect(preferredCellFor([A])).toBe(grid);
  });

  it('prefers a grid copy of a LATER candidate over a strip copy of an earlier one', () => {
    // Candidate order yields to copy quality: the point of pointing is to move the
    // operator's eye to the grid, and the strip is already in front of them.
    const stripOfA = drawn({ isCell: true, inStrip: true });
    const gridOfB = drawn({ isCell: true });
    stubDocument({ [A]: [stripOfA], [B]: [gridOfB] });

    expect(preferredCellFor([A, B])).toBe(gridOfB);
  });

  it('falls back to the strip copy rather than returning nothing', () => {
    // Still the right matchUp. Doing nothing is a worse answer than pulsing a cell
    // that happens to be in view — and it is what the old code did in this case.
    const strip = drawn({ isCell: true, inStrip: true });
    stubDocument({ [A]: [strip] });

    expect(preferredCellFor([A])).toBe(strip);
  });

  it('ignores non-cell surfaces — a catalog card is not somewhere to scroll the grid to', () => {
    stubDocument({ [A]: [drawn()] });
    expect(preferredCellFor([A])).toBeNull();
  });

  it('returns null when the page draws none of the candidates', () => {
    stubDocument({});
    expect(preferredCellFor([A, B])).toBeNull();
  });
});
