export const confidenceBands = { high: [80, 100], medium: [60, 80], low: [40, 60] };
import { fixtures } from 'tods-competition-factory';

const { ratingsParameters } = fixtures;

export const ratingSorter = (rating) => (a, b) => {
  const ratingDetails = ratingsParameters[rating];
  if (!ratingDetails) return 0;

  const { accessor, ascending } = ratingDetails;
  const reversed = !ascending;

  const ac = getConfidenceValue(a);
  const bc = getConfidenceValue(b);

  if (ac < bc) return 1;
  if (bc < ac) return -1;

  const ratingA = a?.[accessor] || 0;
  const ratingB = b?.[accessor] || 0;

  return reversed ? ratingA - ratingB : ratingB - ratingA;
};

function getConfidenceValue(x) {
  const band = getConfidenceBand(x.confidence ?? 100);
  return (band === 'high' && 100) || (band === 'medium' && 80) || (band === 'low' && 60) || 0;
}

export function getConfidenceBand(value) {
  if (parseInt(value) >= confidenceBands.high[0]) return 'high';
  if (parseInt(value) >= confidenceBands.medium[0]) return 'medium';
  if (parseInt(value) >= confidenceBands.low[0]) return 'low';
  return 'unrated';
}
