/**
 * Draws view — view-mode (cards vs table) state with localStorage persistence.
 * Default mode is `'grid'` per product direction.
 */

export type DrawsViewMode = 'grid' | 'table';

const VIEW_MODE_KEY = 'tmx_draws_view_mode';

export function readDrawsViewMode(): DrawsViewMode {
  try {
    const stored = globalThis.localStorage?.getItem(VIEW_MODE_KEY);
    return stored === 'table' ? 'table' : 'grid';
  } catch {
    return 'grid';
  }
}

export function writeDrawsViewMode(mode: DrawsViewMode): void {
  try {
    globalThis.localStorage?.setItem(VIEW_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}
