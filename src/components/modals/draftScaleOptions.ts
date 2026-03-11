/**
 * Discovers available rating/ranking scale names from tournament participants.
 * Extracted for testability — pure function over participant data.
 */

export interface ScaleOption {
  label: string;
  value: string;
  scaleType: 'RATING' | 'RANKING';
}

export interface ParticipantScales {
  participantId?: string;
  ratings?: Record<string, { scaleName: string; scaleValue?: any }[]>;
  rankings?: Record<string, { scaleName: string; scaleValue?: any }[]>;
}

/**
 * Given hydrated participants (with `withScaleValues: true`), returns
 * deduplicated scale options found in the tournament, grouped by type.
 *
 * @param participants - Array of participants with `.ratings` and `.rankings` hydrated
 * @param eventType - Optional event type key (e.g. 'SINGLES', 'DOUBLES') to scope lookup
 * @returns ScaleOption[] sorted: ratings first then rankings, alphabetical within each group
 */
export function getTournamentScaleOptions(participants: ParticipantScales[], eventType?: string): ScaleOption[] {
  const ratingNames = new Set<string>();
  const rankingNames = new Set<string>();

  for (const p of participants) {
    const ratingEntries = eventType ? p.ratings?.[eventType] : Object.values(p.ratings ?? {}).flat();
    for (const item of ratingEntries ?? []) {
      if (item.scaleName) ratingNames.add(item.scaleName);
    }

    const rankingEntries = eventType ? p.rankings?.[eventType] : Object.values(p.rankings ?? {}).flat();
    for (const item of rankingEntries ?? []) {
      if (item.scaleName) rankingNames.add(item.scaleName);
    }
  }

  const options: ScaleOption[] = [];

  for (const name of [...ratingNames].sort()) {
    options.push({ label: `Rating: ${name}`, value: name, scaleType: 'RATING' });
  }
  for (const name of [...rankingNames].sort()) {
    options.push({ label: `Ranking: ${name}`, value: name, scaleType: 'RANKING' });
  }

  return options;
}

/**
 * Resolves a display value from a scaleValue, which may be a primitive or
 * an object requiring an accessor key (e.g. { wtnRating: 23.5, confidence: 80 }).
 *
 * @param scaleValue - The raw scale value (number, string, or object with accessor keys)
 * @param accessor - Optional accessor key into the object (e.g. 'wtnRating', 'duprRating')
 * @returns The resolved display string, or undefined if no value found
 */
export function resolveScaleDisplayValue(scaleValue: any, accessor?: string): string | undefined {
  if (scaleValue == null) return undefined;

  // Primitive — use directly
  if (typeof scaleValue !== 'object') return String(scaleValue);

  // Object — use accessor to extract the value
  if (accessor) {
    const val = scaleValue[accessor];
    if (val != null) return String(val);
  }

  // Fallback: try common accessor pattern `${scaleName.toLowerCase()}Rating`
  // not feasible without scaleName here — return undefined
  return undefined;
}

/**
 * Builds a map of participantId → display string for a given scale.
 *
 * @param participants - Array of participants with `.ratings` and `.rankings` hydrated
 * @param scaleType - 'RATING' or 'RANKING'
 * @param scaleName - The specific scale name (e.g. 'DUPR', 'WTN')
 * @param eventType - Optional event type key to scope lookup
 * @param accessor - Optional accessor key for object-valued scales (e.g. 'wtnRating')
 * @returns Map<participantId, displayValue>
 */
export function getParticipantScaleValues(
  participants: ParticipantScales[],
  scaleType: 'RATING' | 'RANKING',
  scaleName: string,
  eventType?: string,
  accessor?: string,
): Map<string, string> {
  const result = new Map<string, string>();

  for (const p of participants) {
    if (!p.participantId) continue;

    const scaleGroup = scaleType === 'RATING' ? p.ratings : p.rankings;
    const entries = eventType ? scaleGroup?.[eventType] : Object.values(scaleGroup ?? {}).flat();

    for (const item of entries ?? []) {
      if (item.scaleName === scaleName && item.scaleValue != null) {
        const display = resolveScaleDisplayValue(item.scaleValue, accessor);
        if (display != null) result.set(p.participantId, display);
        break;
      }
    }
  }

  return result;
}

/**
 * Re-sorts participant IDs by their scale values and distributes them into tiers.
 * Used for live preview when the user changes the scale or sort direction.
 *
 * @param participantIds - All participant IDs across all tiers
 * @param scaleValues - Map of participantId → numeric display value
 * @param ascending - true = lower values in tier 1; false = higher values in tier 1
 * @param tierCount - Number of tiers to create
 * @returns Array of tier objects with participantIds
 */
export function previewTierSort(
  participantIds: string[],
  scaleValues: Map<string, string>,
  ascending: boolean,
  tierCount: number,
): { participantIds: string[] }[] {
  const withValue: { id: string; num: number }[] = [];
  const withoutValue: string[] = [];

  for (const id of participantIds) {
    const raw = scaleValues.get(id);
    const num = raw != null ? Number.parseFloat(raw) : NaN;
    if (!Number.isNaN(num)) {
      withValue.push({ id, num });
    } else {
      withoutValue.push(id);
    }
  }

  withValue.sort((a, b) => (ascending ? a.num - b.num : b.num - a.num));
  const sorted = [...withValue.map((e) => e.id), ...withoutValue];

  // Distribute into tiers (same algorithm as factory buildTiers)
  const effectiveCount = Math.min(tierCount, sorted.length);
  const tiers: { participantIds: string[] }[] = [];
  const baseSize = Math.floor(sorted.length / effectiveCount);
  const remainder = sorted.length % effectiveCount;

  let offset = 0;
  for (let i = 0; i < effectiveCount; i++) {
    const size = baseSize + (i < remainder ? 1 : 0);
    tiers.push({ participantIds: sorted.slice(offset, offset + size) });
    offset += size;
  }

  return tiers;
}
