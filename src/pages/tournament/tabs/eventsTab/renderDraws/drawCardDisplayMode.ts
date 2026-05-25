/**
 * Draw-card visualization mode — view-level state with localStorage
 * persistence. Single global preference across all tournaments per the
 * tournament-director-preference design.
 */

export type DrawCardDisplayMode = 'none' | 'histogram' | 'competitiveness' | 'sunburst' | 'sunburst-competitive';

const KEY = 'tmx_draws_card_display';

const VALID_MODES: ReadonlySet<string> = new Set([
  'none',
  'histogram',
  'competitiveness',
  'sunburst',
  'sunburst-competitive',
]);

export function readDrawCardDisplayMode(): DrawCardDisplayMode {
  try {
    const stored = globalThis.localStorage?.getItem(KEY);
    if (stored && VALID_MODES.has(stored)) {
      return stored as DrawCardDisplayMode;
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
