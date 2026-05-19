/**
 * Gating logic for draw-card visualizations.
 *
 * Returns the actually-applied display mode for the current render, given
 * the user's requested mode, the number of draws, and which data is
 * actually available on the event.
 *
 * TODO(perf): replace `HARD_CAP` with a heaviness formula along the lines of
 *   score = drawCount * f(avgParticipantsPerDraw) * f(vizMode)
 * once we have real-world telemetry. Until then a single cap is enough.
 */

import type { DrawCardDisplayMode } from './drawCardDisplayMode';

export const HARD_CAP = 15;
export const SUNBURST_CAP = 6;

export interface VizDataAvailability {
  hasRatings: boolean;
  hasCompetitiveness: boolean;
}

export type GateReason = 'over-cap' | 'sunburst-too-many' | 'no-ratings' | 'no-competitiveness';

export interface ResolvedDisplayMode {
  /** Mode actually applied (`'none'` when gated). */
  mode: DrawCardDisplayMode;
  /** What the user originally requested. */
  requested: DrawCardDisplayMode;
  /** True when the requested mode was downgraded to `'none'`. */
  gated: boolean;
  reason?: GateReason;
}

export function resolveDisplayMode({
  requested,
  drawCount,
  availability,
}: {
  requested: DrawCardDisplayMode;
  drawCount: number;
  availability: VizDataAvailability;
}): ResolvedDisplayMode {
  if (requested === 'none') return { mode: 'none', requested, gated: false };

  if (drawCount > HARD_CAP) {
    return { mode: 'none', requested, gated: true, reason: 'over-cap' };
  }
  if (requested === 'sunburst' && drawCount >= SUNBURST_CAP) {
    return { mode: 'none', requested, gated: true, reason: 'sunburst-too-many' };
  }
  if (requested === 'histogram' && !availability.hasRatings) {
    return { mode: 'none', requested, gated: true, reason: 'no-ratings' };
  }
  if (requested === 'competitiveness' && !availability.hasCompetitiveness) {
    return { mode: 'none', requested, gated: true, reason: 'no-competitiveness' };
  }
  return { mode: requested, requested, gated: false };
}

export interface DisplayModeOption {
  value: DrawCardDisplayMode;
  label: string;
  disabled?: boolean;
  reason?: string;
}

export function buildDisplayModeOptions({
  drawCount,
  availability,
}: {
  drawCount: number;
  availability: VizDataAvailability;
}): DisplayModeOption[] {
  const options: DisplayModeOption[] = [
    { value: 'none', label: 'None' },
    {
      value: 'histogram',
      label: 'Ratings histogram',
      disabled: !availability.hasRatings,
      reason: !availability.hasRatings ? 'no ratings' : undefined,
    },
    {
      value: 'competitiveness',
      label: 'Competitiveness',
      disabled: !availability.hasCompetitiveness,
      reason: !availability.hasCompetitiveness ? 'no completed matches' : undefined,
    },
  ];
  // Sunburst only available when the draw count is below the SUNBURST_CAP.
  if (drawCount < SUNBURST_CAP) {
    options.push({ value: 'sunburst', label: 'Sunburst' });
  }
  return options;
}

export function gateReasonLabel(reason: GateReason): string {
  if (reason === 'over-cap') return `Visualizations hidden — too many draws (cap: ${HARD_CAP}).`;
  if (reason === 'sunburst-too-many') return `Sunburst hidden — only available when fewer than ${SUNBURST_CAP} draws.`;
  if (reason === 'no-ratings') return 'No ratings data — histogram hidden.';
  if (reason === 'no-competitiveness') return 'No completed matches — competitiveness hidden.';
  return '';
}
