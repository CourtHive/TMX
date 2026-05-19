/**
 * Draw-card visualization mode — view-level state with localStorage
 * persistence. Single global preference across all tournaments per the
 * tournament-director-preference design.
 */

export type DrawCardDisplayMode = 'none' | 'histogram' | 'competitiveness' | 'sunburst';

const KEY = 'tmx_draws_card_display';

export function readDrawCardDisplayMode(): DrawCardDisplayMode {
  try {
    const stored = globalThis.localStorage?.getItem(KEY);
    if (stored === 'histogram' || stored === 'competitiveness' || stored === 'sunburst' || stored === 'none') {
      return stored;
    }
    return 'none';
  } catch {
    return 'none';
  }
}

export function writeDrawCardDisplayMode(mode: DrawCardDisplayMode): void {
  try {
    globalThis.localStorage?.setItem(KEY, mode);
  } catch {
    /* ignore */
  }
}
