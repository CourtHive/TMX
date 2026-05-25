/**
 * Build a per-draw visualization element for the chosen `DrawCardDisplayMode`.
 *
 * Returns `null` when the draw doesn't have the data needed for the requested
 * mode (e.g. ungenerated flight, or no ratings yet). The card primitive falls
 * back to no-viz behaviour in that case.
 */

import {
  aggregateCompetitiveness,
  buildCompetitivenessDonut,
  buildRatingDistributionChart,
  burstChart,
  fromFactoryDrawData,
} from 'courthive-components';
import { computeRatingDistributionStats, fixtures } from 'tods-competition-factory';

const { ratingsParameters } = fixtures;

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
  const { element, update } = buildCompetitivenessDonut();
  update(buckets);
  const wrap = document.createElement('div');
  wrap.style.cssText = 'width:100%; display:flex; justify-content:center;';
  wrap.appendChild(element);
  return wrap;
}

function unwrapScaleValue(raw: any, accessor: string | undefined): any {
  if (!raw || typeof raw !== 'object') return raw;
  if (accessor && raw[accessor] !== undefined) return raw[accessor];
  // Fallback when the ratingsParameters accessor isn't available — mocksEngine
  // emits `{ wtnRating, confidence }` and similar; the first numeric field is
  // always the rating itself.
  const numeric = Object.values(raw).find((v) => typeof v === 'number');
  return numeric !== undefined ? numeric : raw;
}

function extractRatingFromParticipant(participant: any, scaleKey: string, accessor: string | undefined): number | null {
  const ratings = participant?.ratings;
  if (!ratings) return null;
  for (const category of Object.values(ratings as Record<string, any>)) {
    if (!Array.isArray(category)) continue;
    for (const item of category) {
      if (String(item?.scaleName ?? '').toUpperCase() !== scaleKey) continue;
      const raw = unwrapScaleValue(item.scaleValue, accessor);
      const n = Number(raw);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/** participantIds → numeric rating values for one scale. */
function collectRatingsForDraw(
  participantsById: Map<string, any> | undefined,
  participantIds: string[] | undefined,
  scaleName: string | undefined,
): number[] {
  if (!scaleName || !participantsById || !participantIds?.length) return [];
  const key = String(scaleName).toUpperCase();
  const params: any = (ratingsParameters as any)[key];
  const accessor = params?.accessor;
  const values: number[] = [];
  for (const id of participantIds) {
    const p = participantsById.get(id);
    if (!p) continue;
    const n = extractRatingFromParticipant(p, key, accessor);
    if (n !== null) values.push(n);
    // For pair/team participants, fall back to individualParticipants ratings.
    if (n === null && Array.isArray(p.individualParticipants)) {
      for (const ip of p.individualParticipants) {
        const ipn = extractRatingFromParticipant(ip, key, accessor);
        if (ipn !== null) values.push(ipn);
      }
    }
  }
  return values;
}

function buildHistogramForDraw(
  participantsById: Map<string, any> | undefined,
  participantIds: string[] | undefined,
  scaleName?: string,
): HTMLElement | null {
  const values = collectRatingsForDraw(participantsById, participantIds, scaleName);
  if (values.length < 2) return null;
  const stats = (computeRatingDistributionStats as any)({ ratings: values });
  // Stats shape: `{ histogram: [{ binStart, binEnd, count }, ...] }` — no `bins`.
  if (!stats?.histogram?.length) return null;
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

function buildSunburstForDraw(enrichedStructure: any, expanded: boolean, competitive: boolean): HTMLElement | null {
  // `enrichedStructure` is the `getEventData().drawsData[i].structures[j]`
  // shape that has `roundMatchUps` — NOT the raw `drawDefinition.structures[0]`.
  if (!enrichedStructure?.roundMatchUps) return null;
  const size = expanded ? SUNBURST_SIZE_EXPANDED : SUNBURST_SIZE;
  const container = document.createElement('div');
  container.style.cssText = `width:${size}px; height:${size}px; max-width:100%;`;
  const data = fromFactoryDrawData(enrichedStructure);
  // competitive → color winner rings by matchUp competitiveness (computed by the
  // adapter from score.sets); progression → default seed/entry coloring.
  burstChart({
    width: size,
    height: size,
    colorMode: competitive ? 'competitiveness' : 'default',
    eventHandlers: {},
  }).render(container, data, '');
  return container;
}

export interface BuildVizParams {
  mode: DrawCardDisplayMode;
  drawDefinition: any;
  /** Set by the consumer when sunburst grid is expanded (wider columns). */
  expanded?: boolean;
  /** Active rating scale name used for histogram data collection. */
  ratingScaleName?: string;
  /** Resolved-participants lookup (participantId → participant with `ratings`).
   * Required for histogram mode — raw drawDefinition entries don't carry
   * resolved `participant.ratings`. */
  participantsById?: Map<string, any>;
  /** participantIds assigned to this draw — typically from
   * `tournamentEngine.getAssignedParticipantIds({ drawDefinition })`. */
  drawParticipantIds?: string[];
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
  participantsById,
  drawParticipantIds,
  enrichedStructure,
  competitiveMatchUps,
}: BuildVizParams): HTMLElement | null {
  if (mode === 'none') return null;
  if (!drawDefinition?.structures?.length) return null;
  if (mode === 'competitiveness') return buildCompetitivenessForMatchUps(competitiveMatchUps ?? []);
  if (mode === 'histogram') return buildHistogramForDraw(participantsById, drawParticipantIds, ratingScaleName);
  if (mode === 'sunburst') return buildSunburstForDraw(enrichedStructure, expanded, false);
  if (mode === 'sunburst-competitive') return buildSunburstForDraw(enrichedStructure, expanded, true);
  return null;
}
