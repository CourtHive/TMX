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
