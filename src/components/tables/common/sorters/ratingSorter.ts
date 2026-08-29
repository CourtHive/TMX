export const confidenceBands = { high: [80, 100], medium: [60, 80], low: [40, 60] };
import { resolveScaleValueNumber } from 'functions/resolveScaleValueNumber';
import { fixtures } from 'tods-competition-factory';

const { ratingsParameters } = fixtures;

export const ratingSorter =
  (rating: string) =>
  (a: any, b: any): number => {
    const ratingDetails = ratingsParameters[rating];
    if (!ratingDetails) return 0;

    const accessor = ratingDetails.accessor || `${rating.toLowerCase()}Rating`;
    const { ascending } = ratingDetails;
    const reversed = !ascending;

    const ac = getConfidenceValue(a);
    const bc = getConfidenceValue(b);

    if (ac < bc) return 1;
    if (bc < ac) return -1;

    // Was `a?.[accessor] || 0`. That mapped an unrated participant's '' to 0 —
    // which lands at opposite ends depending on the scale's direction, so
    // "unrated" sorted to the top for UTR and the bottom for WTN — and it
    // collapsed a legitimate 0 into the same bucket as no rating at all.
    const ratingA = resolveScaleValueNumber(a?.[accessor], { accessor, scaleName: rating });
    const ratingB = resolveScaleValueNumber(b?.[accessor], { accessor, scaleName: rating });

    // Unrated sorts last regardless of scale direction, rather than being given
    // a numeric sentinel whose meaning flips with the comparator's polarity.
    if (ratingA === undefined && ratingB === undefined) return 0;
    if (ratingA === undefined) return 1;
    if (ratingB === undefined) return -1;

    return reversed ? ratingA - ratingB : ratingB - ratingA;
  };

function getConfidenceValue(x: any): number {
  const band = getConfidenceBand(x.confidence ?? 100);
  return (band === 'high' && 100) || (band === 'medium' && 80) || (band === 'low' && 60) || 0;
}

export function getConfidenceBand(value: number | string): string {
  if (parseInt(value.toString()) >= confidenceBands.high[0]) return 'high';
  if (parseInt(value.toString()) >= confidenceBands.medium[0]) return 'medium';
  if (parseInt(value.toString()) >= confidenceBands.low[0]) return 'low';
  return 'unrated';
}
