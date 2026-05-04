import { fixtures } from 'tods-competition-factory';

const { ratingsParameters } = fixtures;

// Resolves the rating-record accessor for a given scale (UTR, NTRP, WTN, etc.).
// Mirrors the convention used by seeding / sorting code in TMX: pull the
// canonical accessor from `fixtures.ratingsParameters` when defined, fall
// back to `${scale}Rating` (lowercase scale + "Rating").
function resolveAccessor(scaleName: string): string {
  const params = ratingsParameters?.[scaleName.toUpperCase()];
  return params?.accessor || `${scaleName}Rating`;
}

// Extracts a single numeric rating from a participant for the given scale.
// Returns `undefined` when the participant has no rating record for the
// scale, or when the recorded value is non-numeric. Confidence is intentionally
// ignored — callers that want to weight by confidence should read the rating
// record directly via `participant.ratings[scaleName]`.
export function extractParticipantRating(participant: any, scaleName: string): number | undefined {
  if (!participant || typeof scaleName !== 'string' || scaleName.length === 0) return undefined;
  const ratingRecord = participant.ratings?.[scaleName];
  if (!ratingRecord) return undefined;
  const value = ratingRecord[resolveAccessor(scaleName)];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
