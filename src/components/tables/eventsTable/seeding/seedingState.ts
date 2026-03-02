/**
 * Module-level state for tracking which tables have manual seeding enabled.
 * Uses a WeakSet so table references can be garbage collected.
 *
 * This avoids Tabulator 6's async `updateColumnDefinition` (which deletes
 * and recreates the column) and instead lets the column's `editable`
 * function check this state synchronously on each cell click.
 */
const enabledTables = new WeakSet<object>();

export function isSeedingEnabled(table: object): boolean {
  return enabledTables.has(table);
}

export function setSeedingEnabled(table: object, enabled: boolean): void {
  if (enabled) {
    enabledTables.add(table);
  } else {
    enabledTables.delete(table);
  }
}
