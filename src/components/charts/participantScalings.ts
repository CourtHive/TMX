/**
 * Participant scalings — extract numeric rating values from participants
 * and render a compact / full histogram of the distribution.
 *
 * Used in two places:
 *   - Overview tab: full-width panel above the publishing card
 *   - Participants tab: compact inline chart in the section's tabHeader
 *
 * Performance: the overview consumer should pre-gate render via
 * MAX_PARTICIPANTS_FOR_OVERVIEW so large tournaments don't pay the
 * extraction + render cost up front.
 */
import { computeRatingDistributionStats, factoryConstants, fixtures } from 'tods-competition-factory';
import { buildRatingDistributionChart } from 'courthive-components';

const { ratingsParameters } = fixtures;
const { SINGLES } = factoryConstants.eventConstants;

export const MAX_PARTICIPANTS_FOR_OVERVIEW = 200;

export interface ScaleRatings {
  /** Uppercase scale code (e.g. 'WTN', 'UTR'). */
  scaleName: string;
  /** Human-readable label — currently same as `scaleName`. */
  label: string;
  /** Numeric values for participants that carry this scale. */
  values: number[];
}

/**
 * Walk participants, pull numeric scale values per rating scale.
 * Skips scales with zero finite values. Order is insertion order so
 * callers can stably re-render selectors as filters change.
 */
export function collectAvailableScales(participants: any[]): ScaleRatings[] {
  const map = new Map<string, number[]>();
  for (const p of participants || []) {
    const items = p?.ratings?.[SINGLES] || [];
    for (const item of items) {
      const key = String(item?.scaleName || '').toUpperCase();
      if (!key) continue;
      const params: any = (ratingsParameters as any)[key];
      const accessor = params?.accessor;
      let raw: any = item.scaleValue;
      if (raw && typeof raw === 'object' && accessor) raw = raw[accessor];
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    }
  }
  return Array.from(map.entries()).map(([scaleName, values]) => ({
    scaleName,
    label: scaleName,
    values,
  }));
}

export interface ScalingsChartOptions {
  /** Visual variant. `compact` ≈ 200x36 sparkline; `full` ≈ 480x180 panel chart. */
  variant: 'compact' | 'full';
  /** Initially-selected scale code. Defaults to the first scale in `scales`. */
  initialScale?: string;
  /** Notified on scale switch so consumers can persist the choice. */
  onScaleChange?: (scaleName: string) => void;
}

export interface ScalingsChartHandle {
  /** The mounted root element. Append to the desired parent. */
  element: HTMLElement;
  /** Re-render with a new set of scales (e.g. after the participants table filters). */
  update: (scales: ScaleRatings[]) => void;
}

/**
 * Build a histogram element for a set of participant scales. Includes
 * an inline scale selector when more than one scale is available.
 *
 * The element re-renders on selector change and on `update()` calls,
 * preserving the user's current selection if the selected scale is
 * still present in the new set.
 */
export function buildScalingsChart(scales: ScaleRatings[], options: ScalingsChartOptions): ScalingsChartHandle {
  const root = document.createElement('div');
  const isCompact = options.variant === 'compact';
  root.style.cssText = isCompact
    ? 'display: inline-flex; align-items: center; gap: 8px;'
    : 'display: flex; flex-direction: column; gap: 6px;';

  let current = pickInitialScale(scales, options.initialScale);
  let activeScales = scales;

  const select = document.createElement('select');
  select.style.cssText = isCompact
    ? 'font-size: 0.7rem; padding: 1px 4px; border-radius: 4px; border: 1px solid var(--tmx-border-primary); background: var(--tmx-bg-primary); color: var(--tmx-color-primary);'
    : 'font-size: 0.75rem; padding: 3px 8px; border-radius: 6px; border: 1px solid var(--tmx-border-primary); background: var(--tmx-bg-primary); color: var(--tmx-color-primary);';
  select.addEventListener('change', () => {
    current = select.value;
    options.onScaleChange?.(current);
    redraw();
  });

  const chartHolder = document.createElement('div');
  chartHolder.style.cssText = isCompact
    ? 'display: inline-flex; align-items: center;'
    : 'width: 100%; min-height: 180px;';

  function renderSelect(): void {
    select.replaceChildren();
    for (const s of activeScales) {
      const opt = document.createElement('option');
      opt.value = s.scaleName;
      opt.textContent = `${s.label} (${s.values.length})`;
      if (s.scaleName === current) opt.selected = true;
      select.appendChild(opt);
    }
    // Show the selector only when there's a real choice to make.
    select.style.display = activeScales.length > 1 ? '' : 'none';
  }

  function redraw(): void {
    chartHolder.replaceChildren();
    const target = activeScales.find((s) => s.scaleName === current);
    if (!target || target.values.length === 0) return;
    const stats = computeRatingDistributionStats({ ratings: target.values });
    const chart = buildRatingDistributionChart(stats, {
      mode: 'HISTOGRAM',
      width: isCompact ? 220 : 480,
      height: isCompact ? 36 : 180,
      showAxis: !isCompact,
      showCounts: !isCompact,
      showMean: !isCompact,
      margin: isCompact ? { top: 2, right: 2, bottom: 2, left: 2 } : undefined,
      ariaLabel: `${target.label} distribution (${target.values.length} participants)`,
    });
    chart.style.maxWidth = '100%';
    chart.style.height = isCompact ? '36px' : 'auto';
    chartHolder.appendChild(chart);
  }

  // Chart first, selector to its right — reads as "the data, then the
  // knob that changes it" which feels more natural than label-then-chart.
  root.appendChild(chartHolder);
  root.appendChild(select);

  renderSelect();
  redraw();

  function update(next: ScaleRatings[]): void {
    activeScales = next;
    // Preserve the user's selection if it's still valid; otherwise fall
    // back to the first scale in the new set.
    if (!next.some((s) => s.scaleName === current)) {
      current = pickInitialScale(next, options.initialScale);
    }
    renderSelect();
    redraw();
  }

  return { element: root, update };
}

function pickInitialScale(scales: ScaleRatings[], hint: string | undefined): string {
  if (hint && scales.some((s) => s.scaleName === hint)) return hint;
  return scales[0]?.scaleName || '';
}
