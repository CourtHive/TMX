import { fixtures } from 'tods-competition-factory';

const { ratingsParameters } = fixtures;

// Resolves the rating-record accessor for a given scale (UTR, NTRP, WTN, etc.).
// Pulls the canonical accessor from `fixtures.ratingsParameters` when defined,
// falls back to `${scale}Rating`.
function resolveAccessor(scaleName: string): string {
  const params = ratingsParameters?.[scaleName.toUpperCase()];
  return params?.accessor || `${scaleName}Rating`;
}

// Extracts a single numeric rating from a participant for the given
// scale. Singles only — reads `participant.ratings.SINGLES[]` (the
// shape produced by `getParticipants({ withScaleValues: true })`),
// finds the entry whose `scaleName` matches (case-insensitive), and
// returns the canonical-accessor value from `scaleValue`. Returns
// `undefined` when no matching scale or non-numeric value is found.
export function extractParticipantRating(participant: any, scaleName: string): number | undefined {
  if (!participant || typeof scaleName !== 'string' || scaleName.length === 0) return undefined;

  const singlesArray = participant.ratings?.SINGLES;
  if (!Array.isArray(singlesArray)) return undefined;

  const target = scaleName.toLowerCase();
  const match = singlesArray.find(
    (item: any) => typeof item?.scaleName === 'string' && item.scaleName.toLowerCase() === target,
  );
  if (!match?.scaleValue) return undefined;

  const accessor = resolveAccessor(scaleName);
  const value = match.scaleValue[accessor];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
