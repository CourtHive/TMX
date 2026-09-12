/**
 * Schedule2 — the one handle onto the court grid's search box.
 *
 * The Inspector's rest rows want to drive the search: clicking a player there
 * should put that player's name in the box and light up every cell they appear
 * in for the viewed day. They cannot reach it directly. `gridView.ts:284` imports
 * `inspectorReadiness`, which imports `inspectorRest`, so an import the other way
 * closes a cycle — and the input itself is a local inside `buildSearchSlot`, with
 * no handle out of `gridHeaderActions`.
 *
 * So the header registers its setter here and the Inspector calls it. A module
 * neither side imports from the other keeps the dependency a straight line, and
 * keeps the coupling to one named function rather than a DOM query for an id that
 * nothing would fail on if it were renamed.
 *
 * Registration is last-writer-wins because the header is rebuilt on every
 * `renderSchedulingTab`. The connectedness check is what makes that safe: a
 * registration left behind by a tab the operator has navigated away from reports
 * unavailable rather than writing into a detached input.
 */

type GridSearchControl = {
  /** Put `text` in the box and run the search immediately — no debounce. */
  setText: (text: string) => void;
  /** The live input, so a stale registration can be recognised and dropped. */
  input: HTMLInputElement;
};

let control: GridSearchControl | null = null;

/** Called by the grid header when it builds its search slot. */
export function registerGridSearchControl(next: GridSearchControl): void {
  control = next;
}

/** True when a search box is mounted and reachable — the grid view is on screen. */
export function gridSearchAvailable(): boolean {
  if (control && !control.input.isConnected) control = null;
  return !!control;
}

/**
 * Fill the grid search box with `text` and run it. Returns false when no search
 * box is mounted (plan and profile views have none), so callers can decline to
 * present the affordance rather than offering a click that does nothing.
 */
export function applyGridSearch(text: string): boolean {
  if (!gridSearchAvailable()) return false;
  control?.setText(text);
  return true;
}

/** Test seam — drop any registration so one spec cannot leak into the next. */
export function resetGridSearchControl(): void {
  control = null;
}
