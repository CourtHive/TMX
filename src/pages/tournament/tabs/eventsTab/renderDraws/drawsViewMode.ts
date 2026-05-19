/**
 * Draws view — view-mode (cards vs table) state with localStorage persistence.
 * Default mode is `'table'` for users who have not yet chosen.
 */

export type DrawsViewMode = 'grid' | 'table';

const VIEW_MODE_KEY = 'tmx_draws_view_mode';

export function readDrawsViewMode(): DrawsViewMode {
  try {
    const stored = globalThis.localStorage?.getItem(VIEW_MODE_KEY);
    return stored === 'grid' ? 'grid' : 'table';
  } catch {
    return 'table';
  }
}

export function writeDrawsViewMode(mode: DrawsViewMode): void {
  try {
    globalThis.localStorage?.setItem(VIEW_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}
