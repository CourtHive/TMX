/**
 * Events tab — view-mode (cards vs table) state with localStorage persistence.
 */

export type EventsViewMode = 'grid' | 'table';

const VIEW_MODE_KEY = 'tmx_events_view_mode';

export function readEventsViewMode(): EventsViewMode {
  try {
    const stored = globalThis.localStorage?.getItem(VIEW_MODE_KEY);
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
