/**
 * Events tab — view-mode (cards vs table) state with localStorage persistence.
 * Default mode is `'grid'` (cards) for users who have not yet chosen; a stored `'table'` choice is kept.
 */

export type EventsViewMode = 'grid' | 'table';

const VIEW_MODE_KEY = 'tmx_events_view_mode';

export function readEventsViewMode(): EventsViewMode {
  try {
    const stored = globalThis.localStorage?.getItem(VIEW_MODE_KEY);
    // cards unless the user chose the table (CA 2026-11-08: cards became the default)
    return stored === 'table' ? 'table' : 'grid';
  } catch {
    return 'grid';
  }
}

export function writeEventsViewMode(mode: EventsViewMode): void {
  try {
    globalThis.localStorage?.setItem(VIEW_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}
