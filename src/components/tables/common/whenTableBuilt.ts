/**
 * Run `fn` once a Tabulator instance has finished building.
 *
 * Filter modules are constructed synchronously, immediately after the table is
 * created, but Tabulator builds asynchronously. Restoring a saved filter at that
 * point calls `addFilter` before Tabulator is initialized, and Tabulator warns:
 *
 *   Table Not Initialized - Calling the addFilter function before the table is
 *   initialized may result in inconsistent behavior...
 *
 * The call is not dropped — Tabulator's `initGuard` warns and then proceeds — so
 * this is about honouring the documented contract (and clearing the console)
 * rather than repairing a filter that never applied.
 *
 * Tabulator sets `initialized = true` *before* it dispatches `tableBuilt`, so
 * there is a window in which subscribing alone would never fire. Hence the
 * branch: run now if the table is already up, otherwise wait for the event.
 */
export function whenTableBuilt(table: any, fn: () => void): void {
  if (table?.initialized) {
    fn();
  } else {
    table?.on?.('tableBuilt', fn);
  }
}
