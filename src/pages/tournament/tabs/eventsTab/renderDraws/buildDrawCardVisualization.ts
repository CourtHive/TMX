/**
 * Build a per-draw visualization element for the chosen `DrawCardDisplayMode`.
 *
 * Returns `null` when the draw doesn't have the data needed for the requested
 * mode (e.g. ungenerated flight, or no ratings yet). The card primitive falls
 * back to no-viz behaviour in that case.
 */

import {
  aggregateCompetitiveness,
  buildCompetitivenessBar,
  buildRatingDistributionChart,
  burstChart,
  fromFactoryDrawData,
} from 'courthive-components';
import { computeRatingDistributionStats } from 'tods-competition-factory';

import type { DrawCardDisplayMode } from './drawCardDisplayMode';

const HISTOGRAM_HEIGHT = 80;
const SUNBURST_SIZE = 240;
const SUNBURST_SIZE_EXPANDED = 320;

function buildCompetitivenessForMatchUps(matchUps: any[]): HTMLElement | null {
  // matchUps must be fetched with `contextProfile: { withCompetitiveness: true }`
  // — the raw matchUps on a drawDefinition don't carry `competitiveProfile`.
  const buckets = aggregateCompetitiveness(matchUps);
  const total = buckets.COMPETITIVE + buckets.ROUTINE + buckets.DECISIVE + buckets.WALKOVER;
  if (total === 0) return null;
  const { element, update } = buildCompetitivenessBar();
  update(buckets);
  element.style.width = '100%';
  return element;
}

function collectRatingsFromDraw(drawDefinition: any, scaleName?: string): number[] {
  const values: number[] = [];
  const entries = drawDefinition?.entries ?? [];
  for (const entry of entries) {
    const ratings = entry?.participant?.ratings;
    if (!ratings || !scaleName) continue;
    for (const category of Object.values(ratings as Record<string, any>)) {
      if (!Array.isArray(category)) continue;
      for (const item of category) {
        if (item?.scaleName === scaleName && typeof item?.scaleValue === 'number') {
          values.push(item.scaleValue);
        }
      }
    }
  }
  return values;
}

function buildHistogramForDraw(drawDefinition: any, scaleName?: string): HTMLElement | null {
  const values = collectRatingsFromDraw(drawDefinition, scaleName);
  if (values.length < 2) return null;
  const stats = (computeRatingDistributionStats as any)({ ratings: values });
  if (!stats?.bins?.length) return null;
  const chart = buildRatingDistributionChart(stats, {
    mode: 'HISTOGRAM',
    width: 240,
    height: HISTOGRAM_HEIGHT,
    showAxis: false,
    showCounts: false,
    showMean: false,
    margin: { top: 2, right: 2, bottom: 2, left: 2 },
    ariaLabel: `Ratings distribution (${values.length} entries)`,
  });
  chart.style.maxWidth = '100%';
  chart.style.height = `${HISTOGRAM_HEIGHT}px`;
  // Wrap the SVG in a div so the visualization slot stays HTMLElement-typed.
  const wrap = document.createElement('div');
  wrap.style.cssText = 'width:100%; display:flex; justify-content:center;';
  wrap.appendChild(chart);
  return wrap;
}

function buildSunburstForDraw(enrichedStructure: any, expanded: boolean): HTMLElement | null {
  // `enrichedStructure` is the `getEventData().drawsData[i].structures[j]`
  // shape that has `roundMatchUps` — NOT the raw `drawDefinition.structures[0]`.
  if (!enrichedStructure?.roundMatchUps) return null;
  const size = expanded ? SUNBURST_SIZE_EXPANDED : SUNBURST_SIZE;
  const container = document.createElement('div');
  container.style.cssText = `width:${size}px; height:${size}px; max-width:100%;`;
  const data = fromFactoryDrawData(enrichedStructure);
  burstChart({ width: size, height: size, eventHandlers: {} }).render(container, data, '');
  return container;
}

export interface BuildVizParams {
  mode: DrawCardDisplayMode;
  drawDefinition: any;
  /** Set by the consumer when sunburst grid is expanded (wider columns). */
  expanded?: boolean;
  /** Active rating scale name used for histogram data collection. */
  ratingScaleName?: string;
  /** Enriched structure from `getEventData().drawsData[i].structures[j]` —
   * carries `roundMatchUps` which the sunburst transformer needs. Required
   * for sunburst mode. */
  enrichedStructure?: any;
  /** MatchUps for this draw fetched with `contextProfile: { withCompetitiveness: true }`.
   * Required for competitiveness mode — the raw `drawDefinition.structures[i].matchUps`
   * don't carry `competitiveProfile`. */
  competitiveMatchUps?: any[];
}

export function buildDrawCardVisualization({
  mode,
  drawDefinition,
  expanded = false,
  ratingScaleName,
  enrichedStructure,
  competitiveMatchUps,
}: BuildVizParams): HTMLElement | null {
  if (mode === 'none') return null;
  if (!drawDefinition?.structures?.length) return null;
  if (mode === 'competitiveness') return buildCompetitivenessForMatchUps(competitiveMatchUps ?? []);
  if (mode === 'histogram') return buildHistogramForDraw(drawDefinition, ratingScaleName);
  if (mode === 'sunburst') return buildSunburstForDraw(enrichedStructure, expanded);
  return null;
}
