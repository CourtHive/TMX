/**
 * Schedule2 — the one handle onto the schedule view's mutation executor.
 *
 * Sibling of `gridSearchControl.ts`, for the same reason and with the same shape:
 * `gridView.ts` imports `inspectorReadiness`, so an import the other way closes a
 * cycle. The header registers its search setter there; the grid registers its
 * executor here, and the Inspector calls it.
 *
 * ── Why the Inspector must not call `mutationRequest` directly ──
 *
 * `gridView.executeMethods` is not a thin wrapper. It folds methods into the
 * scenario when the operator is in **plan mode** — where a schedule edit must
 * touch `scheduling.scenarios` and never a matchUp — batches them in bulk mode,
 * and detects a draw deleted by another client between render and dispatch. An
 * Inspector action that reached `mutationRequest` on its own would bypass all
 * three, and the plan-mode bypass is not cosmetic: it would write the official
 * schedule while the operator believed they were drafting.
 *
 * Registration is last-writer-wins and dropped by `destroyGridView`, so an action
 * offered by a tab the operator has navigated away from reports unavailable
 * rather than dispatching into a dead render.
 */

type ScheduleMutationControl = {
  /** Dispatch factory methods and re-render the schedule. Honours plan and bulk mode. */
  execute: (methods: any[]) => void;
};

let control: ScheduleMutationControl | null = null;

/** Called by the grid view once its refresh closure exists. */
export function registerScheduleMutationControl(next: ScheduleMutationControl): void {
  control = next;
}

/** True when a schedule view is mounted and its executor is reachable. */
export function scheduleMutationAvailable(): boolean {
  return !!control;
}

/**
 * Dispatch through the schedule view's executor. Returns false when none is
 * registered, so callers can decline to present the affordance rather than
 * offering a click that does nothing.
 */
export function executeScheduleMethods(methods: any[]): boolean {
  if (!control) return false;
  control.execute(methods);
  return true;
}

/** Dropped on grid teardown, and by specs so one cannot leak into the next. */
export function resetScheduleMutationControl(): void {
  control = null;
}
