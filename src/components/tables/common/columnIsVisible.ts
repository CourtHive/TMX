import { context } from 'services/context';

const STORAGE_KEY = 'tmx_columns';

export function loadColumnVisibility(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) Object.assign(context.columns, JSON.parse(stored));
  } catch {
    // ignore corrupt data
  }
}

export function saveColumnVisibility(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(context.columns));
  } catch {
    // storage full or unavailable
  }
}

/**
 * Marks a column as always-visible: excluded from the headerMenu toggle list and
 * never overridden by saved visibility state.
 *
 * Carried in `cssClass` rather than as a bespoke `lockVisible` key because
 * Tabulator validates every column-definition key against its own option list
 * and warns on the console for anything it does not recognise ("Invalid column
 * definition option: lockVisible"). `cssClass` is a supported option, so the
 * marker travels with the definition — which is where it belongs, since
 * `getDefinition()` is the only handle the headerMenu has on a built column —
 * without tripping the validator.
 */
export const LOCK_VISIBLE_CLASS = 'tmx-lock-visible';

export const isLockedVisible = (def: any): boolean =>
  typeof def?.cssClass === 'string' && def.cssClass.split(/\s+/).includes(LOCK_VISIBLE_CLASS);

/**
 * Returns true unless the user has explicitly hidden this column.
 * Use for columns that default to visible.
 */
export const columnIsVisible = (field) => context.columns[field] !== false;

/**
 * Returns the saved visibility if the user has toggled this column, otherwise returns the default.
 * Use for columns that may default to hidden (e.g. startTime, endTime, official).
 */
export const columnVisibility = (field, defaultVisible: boolean) =>
  field in context.columns ? context.columns[field] : defaultVisible;

/**
 * Apply saved visibility state to all toggleable columns in a definitions array.
 * A column is toggleable when it has both a `title` and a `field` (these are
 * the columns rendered in the headerMenu dropdown).  The column's own `visible`
 * value is treated as the default; any value previously saved in
 * `context.columns` overrides it.
 *
 * Locked columns are always shown: they are excluded from the headerMenu and
 * their visibility is never overridden by saved state (which also shields them
 * from field-name collisions across tables — `context.columns` is a single
 * global map keyed by field name).
 */
export function applyColumnVisibility(columns: any[]): any[] {
  for (const col of columns) {
    if (!col.title || !col.field || isLockedVisible(col)) continue;
    if (col.field in context.columns) {
      col.visible = context.columns[col.field];
    }
  }
  return columns;
}
