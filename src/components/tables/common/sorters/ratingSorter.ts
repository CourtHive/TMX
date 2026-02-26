export const confidenceBands = { high: [80, 100], medium: [60, 80], low: [40, 60] };
import { fixtures } from 'tods-competition-factory';

const { ratingsParameters } = fixtures;

export const ratingSorter = (rating: string) => (a: any, b: any): number => {
  const ratingDetails = ratingsParameters[rating];
  if (!ratingDetails) return 0;

  const accessor = ratingDetails.accessor || `${rating.toLowerCase()}Rating`;
  const { ascending } = ratingDetails;
  const reversed = !ascending;

  const ac = getConfidenceValue(a);
  const bc = getConfidenceValue(b);

  if (ac < bc) return 1;
  if (bc < ac) return -1;

  const ratingA = a?.[accessor] || 0;
  const ratingB = b?.[accessor] || 0;

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
