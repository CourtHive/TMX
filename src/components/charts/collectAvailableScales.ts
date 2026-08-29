/**
 * Pure extraction of per-scale rating values from a list of participants.
 *
 * Split out of `participantScalings.ts` so it can be unit-tested at all: that
 * module imports `courthive-components`, which touches `document` at import
 * time, and TMX's vitest environment is node. A decision left in a
 * DOM-importing module gets no coverage — and this one decides which values
 * enter the rating distribution.
 */

import { resolveScaleValueNumber } from 'functions/resolveScaleValueNumber';

// constants and types
import { factoryConstants, fixtures } from 'tods-competition-factory';

const { ratingsParameters } = fixtures;
const { SINGLES } = factoryConstants.eventConstants;

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
 * Skips scales with no resolvable values. Order is insertion order so
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
      // Was `Number(raw)` behind an isFinite guard. Real records carry '' for a
      // participant with no rating on this scale, and `Number('')` is 0 — which
      // is finite, so a fabricated rating of 0 entered the distribution and
      // moved its min, mean and stddev. Strings are read; '' resolves to
      // undefined; a legitimate 0 is kept.
      const value = resolveScaleValueNumber(item.scaleValue, { accessor, scaleName: key });
      if (value === undefined) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(value);
    }
  }
  return Array.from(map.entries()).map(([scaleName, values]) => ({
    scaleName,
    label: scaleName,
    values,
  }));
}
