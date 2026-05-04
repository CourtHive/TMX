import { extractParticipantRating } from './extractRating';
import { expect, it, describe } from 'vitest';

describe('extractParticipantRating', () => {
  it('returns undefined when participant is missing or has no ratings', () => {
    expect(extractParticipantRating(undefined, 'utr')).toBeUndefined();
    expect(extractParticipantRating({}, 'utr')).toBeUndefined();
    expect(extractParticipantRating({ ratings: {} }, 'utr')).toBeUndefined();
  });

  it('returns undefined when scaleName is empty', () => {
    expect(extractParticipantRating({ ratings: { utr: { utrRating: 5 } } }, '')).toBeUndefined();
  });

  it('reads UTR via the canonical utrRating accessor', () => {
    const participant = { ratings: { utr: { utrRating: 5.5, confidence: 80 } } };
    expect(extractParticipantRating(participant, 'utr')).toEqual(5.5);
  });

  it('reads NTRP via the canonical dntrpRatingHundredths accessor', () => {
    // NTRP stores the rating as a hundredths-precision integer
    // (e.g., 400 = NTRP 4.0). The fixtures.ratingsParameters.NTRP.accessor
    // is 'dntrpRatingHundredths' — readers convert / scale at render.
    const participant = { ratings: { ntrp: { dntrpRatingHundredths: 400 } } };
    expect(extractParticipantRating(participant, 'ntrp')).toEqual(400);
  });

  it('returns undefined when the rating value is non-numeric', () => {
    const participant = { ratings: { utr: { utrRating: 'oops' } } };
    expect(extractParticipantRating(participant, 'utr')).toBeUndefined();
  });

  it('returns undefined when the rating value is NaN or Infinity', () => {
    expect(extractParticipantRating({ ratings: { utr: { utrRating: NaN } } }, 'utr')).toBeUndefined();
    expect(extractParticipantRating({ ratings: { utr: { utrRating: Infinity } } }, 'utr')).toBeUndefined();
  });

  it('falls back to the {scale}Rating accessor when no fixture parameter exists', () => {
    const participant = { ratings: { custom: { customRating: 3.2 } } };
    expect(extractParticipantRating(participant, 'custom')).toEqual(3.2);
  });
});
