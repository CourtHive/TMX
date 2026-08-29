import { extractParticipantRating } from './extractRating';
import { expect, it, describe } from 'vitest';

// The participant shape under test is the one produced by
// `tournamentEngine.getParticipants({ withIndividualParticipants: true,
// withScaleValues: true })` — singles ratings live at
// `participant.ratings.SINGLES[]` as an array of
// `{ scaleName, scaleDate, scaleValue: { <accessor>: number } }` items.

function singlesRating(scaleName: string, scaleValue: Record<string, unknown>) {
  return { ratings: { SINGLES: [{ scaleName, scaleValue, scaleDate: '2026-05-04' }] } };
}

describe('extractParticipantRating', () => {
  it('returns undefined when participant is missing or has no ratings', () => {
    expect(extractParticipantRating(undefined, 'utr')).toBeUndefined();
    expect(extractParticipantRating({}, 'utr')).toBeUndefined();
    expect(extractParticipantRating({ ratings: {} }, 'utr')).toBeUndefined();
  });

  it('returns undefined when ratings.SINGLES is not an array', () => {
    expect(extractParticipantRating({ ratings: { SINGLES: null } }, 'utr')).toBeUndefined();
  });

  it('returns undefined when scaleName is empty', () => {
    expect(extractParticipantRating(singlesRating('UTR', { utrRating: 5 }), '')).toBeUndefined();
  });

  it('reads UTR via the canonical utrRating accessor (case-insensitive scaleName match)', () => {
    expect(extractParticipantRating(singlesRating('UTR', { utrRating: 5.5 }), 'utr')).toEqual(5.5);
    expect(extractParticipantRating(singlesRating('UTR', { utrRating: 5.5 }), 'UTR')).toEqual(5.5);
  });

  it('reads NTRP via the canonical dntrpRatingHundredths accessor', () => {
    // NTRP stores the rating as a hundredths-precision integer
    // (e.g., 400 = NTRP 4.0). The fixtures.ratingsParameters.NTRP.accessor
    // is 'dntrpRatingHundredths'.
    expect(extractParticipantRating(singlesRating('NTRP', { dntrpRatingHundredths: 400 }), 'ntrp')).toEqual(400);
  });

  it('returns undefined when the rating value is non-numeric', () => {
    expect(extractParticipantRating(singlesRating('UTR', { utrRating: 'oops' }), 'utr')).toBeUndefined();
  });

  it('returns undefined when the rating value is NaN or Infinity', () => {
    expect(extractParticipantRating(singlesRating('UTR', { utrRating: NaN }), 'utr')).toBeUndefined();
    expect(extractParticipantRating(singlesRating('UTR', { utrRating: Infinity }), 'utr')).toBeUndefined();
  });

  it('returns undefined when no scale-name entry matches', () => {
    expect(extractParticipantRating(singlesRating('UTR', { utrRating: 5 }), 'wtn')).toBeUndefined();
  });

  it('falls back to the {scale}Rating accessor when no fixture parameter exists', () => {
    expect(extractParticipantRating(singlesRating('CUSTOM', { customRating: 3.2 }), 'custom')).toEqual(3.2);
  });
});

/**
 * Added alongside the original suite, not in place of it.
 *
 * These shapes come from production records (ITA regional championships) and are
 * the ones mocksEngine cannot produce: a rating stored as a STRING, an EMPTY
 * STRING for a participant with no rating on that scale, and a legitimate ZERO.
 * The previous `typeof value === 'number'` gate passed every case above and
 * rejected every real rating — and the caller turns a rejected rating into an
 * excluded participant, then bails with INSUFFICIENT_RATED_PARTICIPANTS, so the
 * whole format wizard reported a fully rated field as unrated.
 */
describe('extractParticipantRating — production value shapes', () => {
  it('reads a STRING rating, which is how ingested records store them', () => {
    expect(extractParticipantRating(singlesRating('UTR', { utrRating: '12.48' }), 'utr')).toEqual(12.48);
  });

  it('gives string and number representations the same result', () => {
    expect(extractParticipantRating(singlesRating('UTR', { utrRating: '9.20' }), 'utr')).toEqual(
      extractParticipantRating(singlesRating('UTR', { utrRating: 9.2 }), 'utr'),
    );
  });

  it('returns undefined for an empty-string rating rather than reading it as zero', () => {
    expect(extractParticipantRating(singlesRating('UTR', { utrRating: '' }), 'utr')).toBeUndefined();
    expect(extractParticipantRating(singlesRating('UTR', { utrRating: '   ' }), 'utr')).toBeUndefined();
  });

  it('preserves a legitimate zero instead of discarding it as absent', () => {
    // PSA declares range [0, 3000] — a new player really is on zero points.
    expect(extractParticipantRating(singlesRating('PSA', { psaPoints: 0 }), 'psa')).toEqual(0);
  });

  it('takes the rating rather than a sibling attribute on a multi-property scale', () => {
    expect(extractParticipantRating(singlesRating('WTN', { confidence: 90, wtnRating: '4.13' }), 'wtn')).toEqual(4.13);
  });
});
