/**
 * Schedule2 — finding the element that stands for a matchUp on the page.
 *
 * Every surface that draws a matchUp carries `data-matchup-id`: court-grid cells,
 * active-strip cells, catalog cards. That uniformity is what lets "show me that one"
 * work without a registry — and it is also the trap this module exists to hold in
 * one place.
 *
 * ── `.spl-grid-cell[data-matchup-id="…"]` is NOT unique ──
 *
 * The active strip above the grid draws a **second** cell, with the same class and
 * the same id, for every scheduled matchUp that is not yet complete. It comes
 * **first** in document order, so `querySelector` returns it and `find` picks it.
 *
 * Both consequences have bitten:
 *
 *   - the strip is a sticky band that is already in view, so scrolling to it moves
 *     nothing while the grid cell the operator was sent to stays off screen. That
 *     was live in `gridActionBar.scrollToMatchUp` — every click in the Issues
 *     popover, because conflicts are overwhelmingly about matches still to be
 *     played, which is precisely the set the strip draws;
 *   - in Playwright it is a strict-mode violation, which is how it was found.
 *
 * The two selectors and the rule that relates them live here rather than in each
 * caller. A rename of either class in `courthive-components` then has one site to
 * follow, instead of two that can disagree for months — the duplicated-knowledge
 * divergence the architectural standards name.
 *
 * DOM-only and dependency-free on purpose: TMX runs vitest in the node environment,
 * so anything reaching the `courthive-components` barrel from here would drag a
 * datepicker that calls `document.createRange()` at load into every unit test that
 * touches the Inspector.
 */

/** A cell on the court grid — and, confusingly, in the active strip. See the header. */
export const GRID_CELL = '.spl-grid-cell';
/** The due/on-court band above the grid, which draws the duplicate copy. Internal — the
 *  rule that uses it is `isGridCopy`, and callers should ask that rather than re-derive it. */
const ACTIVE_STRIP = '.spl-active-strip';

/** Every element the page currently draws for `matchUpId`, on any surface. */
export function drawnFor(matchUpId: string): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(`[data-matchup-id="${CSS.escape(matchUpId)}"]`)];
}

/** True for the COURT-GRID copy of a cell — a grid cell that is not the strip's duplicate. */
export function isGridCopy(element: HTMLElement): boolean {
  return element.matches(GRID_CELL) && !element.closest(ACTIVE_STRIP);
}

/**
 * The best cell to point at for any of `matchUpIds`, or null when none is drawn.
 *
 * Callers pass a candidate list because an issue names a conflict rather than a single
 * matchUp, and only some of the parties to it may be on the viewed day.
 *
 * **A grid copy of a later candidate beats a strip copy of an earlier one.** The point
 * of pointing is to move the operator's eye to the grid, and a strip cell is already
 * in front of them — so candidate order yields to copy quality. The strip copy is kept
 * as a last resort rather than returning null: it is still the right matchUp, and
 * doing nothing is a worse answer than pulsing a cell that happens to be in view.
 */
export function preferredCellFor(matchUpIds: string[]): HTMLElement | null {
  const cells = matchUpIds.flatMap(drawnFor).filter((element) => element.matches(GRID_CELL));
  return cells.find(isGridCopy) ?? cells[0] ?? null;
}
