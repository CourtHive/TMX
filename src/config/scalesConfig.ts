/**
 * Rating scales configuration.
 * Derived from factory ratingsParameters at module load time (static).
 */
import { fixtures } from 'tods-competition-factory';

const { ratingsParameters } = fixtures;

export interface ScaleEntry {
  accessor: string;
  scaleName: string;
  scaleType: string;
  scaleColor?: string;
}

const scaleColorMap: Record<string, string> = { WTN: 'red' };

const scales: Record<string, ScaleEntry> = {};
for (const [key, value] of Object.entries(ratingsParameters) as [string, any][]) {
  const entry: ScaleEntry = {
    accessor: value.accessor,
    scaleType: 'RATING',
    scaleName: key,
  };
  if (scaleColorMap[key]) entry.scaleColor = scaleColorMap[key];
  scales[key.toLowerCase()] = entry;
}

/** Immutable map of available rating scales, keyed by lowercase name */
export const scalesMap: Readonly<Record<string, ScaleEntry>> = scales;
