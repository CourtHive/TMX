/**
 * Venues tab — view-mode (cards vs table) state with localStorage persistence.
 * Availability grid is a third visual mode handled by URL/route, not by this state.
 */

export type VenuesViewMode = 'grid' | 'table';

const VIEW_MODE_KEY = 'tmx_venues_view_mode';

export function readVenuesViewMode(): VenuesViewMode {
  try {
    const stored = globalThis.localStorage?.getItem(VIEW_MODE_KEY);
    return stored === 'table' ? 'table' : 'grid';
  } catch {
    return 'grid';
  }
}

export function writeVenuesViewMode(mode: VenuesViewMode): void {
  try {
    globalThis.localStorage?.setItem(VIEW_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}
