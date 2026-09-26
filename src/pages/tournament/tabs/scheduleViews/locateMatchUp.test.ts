/**
 * `locateMatchUp` without a document — and, with a stubbed one, the part of it that
 * is a real decision rather than a DOM call.
 *
 * TMX runs vitest in the **node** environment, which is the constraint that shaped
 * this module: the paint is injected rather than imported, because the
 * `courthive-components` barrel evaluates a datepicker that calls
 * `document.createRange()` at load and would take every unit test of the Inspector
 * with it. Two things follow, and both are checked here.
 *
 * First, a caller can arrive before anything has registered a paint. That must
 * report failure rather than throw: a throw inside the rest section's delegated
 * click handler takes the whole section's interaction down with it.
 *
 * Second, WHICH of the drawn copies gets scrolled to is a decision, not a DOM
 * detail. The active strip draws a second cell with the same `.spl-grid-cell` class
 * for anything due or on court, it comes first in document order, and it is a sticky
 * band that is already in view — so scrolling to it moves nothing while the grid
 * cell it stands for stays hidden. A pair of stub elements pins that; the rendered
 * article is Journey 131.
 */
import { locateMatchUp, registerMatchUpHighlighter, resetMatchUpHighlighter } from './locateMatchUp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const MATCH_UP_ID = 'mu-r16-brik-michel';
const EXPECTED_SELECTOR = `[data-matchup-id="${MATCH_UP_ID}"]`;

/**
 * One element the page has drawn for the matchUp. Only the three members
 * `locateMatchUp` actually reads — a narrower stub than a document, and it fails
 * loudly if the implementation starts reading a fourth.
 */
function drawn({ isCell = false, inStrip = false } = {}) {
  return {
    matches: (selector: string) => selector === '.spl-grid-cell' && isCell,
    closest: (selector: string) => (selector === '.spl-active-strip' && inStrip ? {} : null),
    scrollIntoView: vi.fn(),
  };
}

/** Stand in for the document, returning `elements` for any query. */
function stubDocument(elements: unknown[]) {
  const querySelectorAll = vi.fn(() => elements);
  vi.stubGlobal('document', { querySelectorAll });
  // `CSS.escape` is a browser global and absent in node; the real one is identity
  // for a uuid, which is what every matchUpId is.
  vi.stubGlobal('CSS', { escape: (value: string) => value });
  return querySelectorAll;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  resetMatchUpHighlighter();
});
afterEach(() => vi.unstubAllGlobals());

describe('locateMatchUp — before anything has registered a paint', () => {
  it('reports failure rather than throwing, and without reaching for the document', () => {
    // The falsifier for the guard ORDER: move the registration check below the
    // query and this throws a ReferenceError in the node suite instead of returning.
    expect(globalThis.document).toBeUndefined();
    expect(() => locateMatchUp(MATCH_UP_ID)).not.toThrow();
    expect(locateMatchUp(MATCH_UP_ID)).toBe(false);
  });
});

describe('locateMatchUp — with a paint registered', () => {
  it('queries every surface by matchUp id, and paints nothing when the page draws none', () => {
    const highlight = vi.fn();
    registerMatchUpHighlighter(highlight);
    const querySelectorAll = stubDocument([]);

    expect(locateMatchUp(MATCH_UP_ID)).toBe(false);
    // Not scoped to the grid: a catalog card or a strip cell is a legitimate place
    // to light the matchUp up, and all three carry the same attribute.
    expect(querySelectorAll).toHaveBeenCalledWith(EXPECTED_SELECTOR);
    // Nothing drawn means nothing to paint — a highlight call here would light up
    // the previous target's cells by clearing and re-applying to an empty set.
    expect(highlight).not.toHaveBeenCalled();
  });

  it('paints the matchUp and scrolls to the GRID cell, not the active-strip copy', () => {
    const highlight = vi.fn();
    registerMatchUpHighlighter(highlight);
    // Document order: the strip comes first, which is the trap. `find` on
    // `.spl-grid-cell` alone would take it.
    const strip = drawn({ isCell: true, inStrip: true });
    const grid = drawn({ isCell: true });
    stubDocument([strip, grid]);

    expect(locateMatchUp(MATCH_UP_ID)).toBe(true);
    expect(highlight).toHaveBeenCalledWith([MATCH_UP_ID]);
    expect(grid.scrollIntoView).toHaveBeenCalledTimes(1);
    // The control. Without it, "scrolls to a cell" passes on the sticky band that
    // is already in view while the grid cell stays off screen.
    expect(strip.scrollIntoView).not.toHaveBeenCalled();
  });

  it('falls back to the strip copy when the grid does not draw the matchUp', () => {
    // A matchUp on court whose grid cell is not rendered for the viewed day still
    // has somewhere to point; inert would be the wrong answer.
    registerMatchUpHighlighter(vi.fn());
    const strip = drawn({ isCell: true, inStrip: true });
    stubDocument([strip]);

    expect(locateMatchUp(MATCH_UP_ID)).toBe(true);
    expect(strip.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('falls back to a non-cell surface — a catalog card is better than nothing', () => {
    registerMatchUpHighlighter(vi.fn());
    const card = drawn();
    stubDocument([card]);

    expect(locateMatchUp(MATCH_UP_ID)).toBe(true);
    expect(card.scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
