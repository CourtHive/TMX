/**
 * The matchUps page's colours, in one place (CA 2026-11-08: the chips take the bars' colours).
 *
 * The Today bar paints its day-of-play buckets with these, and the status chips (popover and table footer) take the
 * same colour for the same bucket. "To be played" folds three Today buckets (called, ready to score, not ready); it
 * takes ready-to-score's teal, because the not-ready grey reads as disabled on a chip that is on.
 *
 * The profile colours are the competitiveness bar's own pairs (courthive-components
 * `competitivenessBar/competitiveness-bar.css`, `--chc-cb-*`), which that stylesheet scopes to the bar: a chip outside
 * it names the same theme tokens. Each fill comes with its ink, both themed light and dark.
 */
export type ChipColor = { color: string; ink: string };

// text on a status fill: white in light, dark in dark, where the status colours are light (theme.css)
const STATUS_INK = 'var(--tmx-on-status)';

export const TODAY_COLORS = {
  complete: 'var(--chc-status-success, #16a34a)',
  live: 'var(--chc-status-info, #3b82f6)',
  suspended: 'var(--chc-status-warning, #d97706)',
  called: 'var(--chc-status-violet, #7c3aed)',
  readyToScore: 'var(--chc-status-teal, #0d9488)',
  notReady: 'var(--chc-text-muted, #6b7280)',
} as const;

export const STATUS_BUCKET_COLORS: Record<string, ChipColor> = {
  // --chc-status-teal is defined by no palette: the teal is its #0d9488 fallback, dark in both themes, so white
  toBePlayed: { color: TODAY_COLORS.readyToScore, ink: 'var(--tmx-on-dark-fill)' },
  live: { color: TODAY_COLORS.live, ink: STATUS_INK },
  suspended: { color: TODAY_COLORS.suspended, ink: STATUS_INK },
  complete: { color: TODAY_COLORS.complete, ink: STATUS_INK },
};

export const PROFILE_COLORS: Record<string, ChipColor> = {
  COMPETITIVE: { color: 'var(--chc-container-success)', ink: 'var(--chc-on-success)' },
  ROUTINE: { color: 'var(--chc-container-info)', ink: 'var(--chc-on-info)' },
  DECISIVE: { color: 'var(--chc-accent-purple)', ink: 'var(--chc-bg-primary)' },
  WALKOVER: { color: 'var(--chc-pill-bg-dark)', ink: 'var(--chc-pill-text)' },
};
