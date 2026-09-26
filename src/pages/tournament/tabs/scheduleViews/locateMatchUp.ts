/**
 * Schedule2 — point the page at one matchUp.
 *
 * The page draws a matchUp in more than one place and always under the same
 * attribute: court-grid cells, catalog cards and active-strip cells all carry
 * `data-matchup-id`. So "show me that one" needs no registry of its own — the
 * document already knows where each matchUp is.
 *
 * ── Why the paint is INJECTED rather than imported ──
 *
 * The paint belongs to `courthive-components` (`applyRelatedHighlight`), and this
 * module must not import it. Reaching the barrel from here would drag it into
 * every unit test that touches the Inspector: the barrel evaluates
 * `vanillajs-datepicker`, which calls `document.createRange()` at module load, and
 * TMX runs vitest **without a DOM**. Importing it cost four green test files the
 * first time this was written.
 *
 * So `inspectorReadiness` — the Inspector's composition root, which already holds
 * that import and is the only caller of `renderRestSection` — registers the paint
 * here, and this module stays free of everything but the document. Same shape as
 * `gridSearchControl`, for the same reason: a module neither side imports from the
 * other keeps the dependency a straight line.
 *
 * Which of the drawn copies is the grid's own is `scheduleCellLookup`'s question,
 * not this module's — the active strip draws a duplicate cell with the same class and
 * id, and the rule that tells them apart is shared with `gridActionBar` so a class
 * rename in `courthive-components` has one site to follow rather than two.
 *
 * ── Why the RELATED paint and not the issue pulse ──
 *
 * `gridActionBar` has a near-identical gesture for the issues panel, and it pulses
 * amber (`spl-cell--issue-pulse`, `--sp-warn`) because what it points at is a
 * scheduling fault. What gets pointed at from here is the opposite: the
 * quarterfinal a semifinal is waiting on is ordinary draw structure. Amber would
 * teach the operator that a normal draw is full of problems — the same reasoning
 * that made `spl-related-highlight` a separate class from the conflict highlight
 * in the first place.
 *
 * ── Why "nothing drawn" is returned rather than swallowed ──
 *
 * A feeder need not be on screen: it may be unscheduled, or scheduled on a day the
 * operator is not looking at. Highlighting nothing and reporting success would
 * leave a click that looks broken, so the caller gets to say why instead.
 */

import { drawnFor, isGridCopy, GRID_CELL } from './scheduleCellLookup';

/** Lights up every element drawn for the given matchUps. `applyRelatedHighlight`, injected. */
type MatchUpHighlighter = (matchUpIds: string[]) => void;

let highlighter: MatchUpHighlighter | null = null;

/** Called once by the Inspector's composition root. Last writer wins. */
export function registerMatchUpHighlighter(next: MatchUpHighlighter): void {
  highlighter = next;
}

/** Test seam — drop any registration so one spec cannot leak into the next. */
export function resetMatchUpHighlighter(): void {
  highlighter = null;
}

/**
 * Highlight `matchUpId` wherever the page draws it and bring it into view.
 *
 * False means the page draws it nowhere — the caller's cue to explain rather than
 * leave a dead click. It also covers the case where nothing registered a paint,
 * which is a wiring fault rather than an operator condition: the journey asserts
 * the highlight class lands, so it cannot go unnoticed.
 */
export function locateMatchUp(matchUpId: string): boolean {
  if (!highlighter) return false;
  const drawn = drawnFor(matchUpId);
  if (!drawn.length) return false;

  highlighter([matchUpId]);
  // `nearest` rather than `center`: the operator is reading the Inspector, and a
  // cell already on screen should not be dragged to the middle under them.
  scrollTarget(drawn).scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  return true;
}

/**
 * Which of the drawn copies to scroll to.
 *
 * A matchUp is drawn up to three times and only one of them is worth scrolling to:
 *
 *   - the **court-grid cell** — the answer to "where is it on the grid", and the only
 *     one that can actually be off screen;
 *   - the **active-strip cell**, for anything due or on court. It carries the same
 *     `.spl-grid-cell` class, and it is a sticky band that is already in view — so
 *     scrolling to it moves nothing while the grid cell it stands for stays hidden;
 *   - a **catalog card**, which lives in a separate scroller — scrolling the sidebar
 *     is not an answer to a question about the grid.
 *
 * All of them still get the highlight, which is right: the operator may be looking at
 * any of them. Only the scroll has to choose.
 *
 * Falls back through the strip copy to any drawn element rather than returning
 * nothing: a matchUp the grid does not draw still has somewhere to point, and inert
 * would be the wrong answer.
 */
function scrollTarget(drawn: HTMLElement[]): HTMLElement {
  return drawn.find(isGridCopy) ?? drawn.find((element) => element.matches(GRID_CELL)) ?? drawn[0];
}
