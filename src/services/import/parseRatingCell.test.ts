import { parseRatingCell } from './parseRatingCell';
import { describe, expect, it } from 'vitest';

describe('parseRatingCell — embedded prefixes', () => {
  it('parses "UTR 8.5"', () => {
    expect(parseRatingCell('UTR 8.5')).toEqual({ scaleName: 'UTR', value: 8.5 });
  });

  it('parses "WTN 12.0"', () => {
    expect(parseRatingCell('WTN 12.0')).toEqual({ scaleName: 'WTN', value: 12 });
  });

  it('parses "NTRP 4.5"', () => {
    expect(parseRatingCell('NTRP 4.5')).toEqual({ scaleName: 'NTRP', value: 4.5 });
  });

  it('parses "DUPR=4.123"', () => {
    expect(parseRatingCell('DUPR=4.123')).toEqual({ scaleName: 'DUPR', value: 4.123 });
  });

  it('parses "ELO: 1700"', () => {
    expect(parseRatingCell('ELO: 1700')).toEqual({ scaleName: 'ELO', value: 1700 });
  });

  it('is case-insensitive on the scale name', () => {
    expect(parseRatingCell('utr 9.0')).toEqual({ scaleName: 'UTR', value: 9 });
    expect(parseRatingCell('Wtn 14')).toEqual({ scaleName: 'WTN', value: 14 });
  });

  it('prefers longer scale names over their prefixes', () => {
    // "UTR_P 8.5" must be UTR_P, not UTR.
    expect(parseRatingCell('UTR_P 8.5')).toEqual({ scaleName: 'UTR_P', value: 8.5 });
  });

  it('parses an integer value', () => {
    expect(parseRatingCell('NTRP 4')).toEqual({ scaleName: 'NTRP', value: 4 });
  });
});

describe('parseRatingCell — default scale fallback', () => {
  it('parses plain "5.0" with NTRP default', () => {
    expect(parseRatingCell('5.0', { defaultScaleName: 'NTRP' })).toEqual({
      scaleName: 'NTRP',
      value: 5,
    });
  });

  it('parses NTRP-style "5.0+" suffix', () => {
    expect(parseRatingCell('5.0+', { defaultScaleName: 'NTRP' })).toEqual({
      scaleName: 'NTRP',
      value: 5,
    });
  });

  it('parses NTRP-style "5.0+ (Pro)" suffix', () => {
    expect(parseRatingCell('5.0+ (Pro)', { defaultScaleName: 'NTRP' })).toEqual({
      scaleName: 'NTRP',
      value: 5,
    });
  });

  it('parses plain integer with default scale', () => {
    expect(parseRatingCell('1700', { defaultScaleName: 'ELO' })).toEqual({
      scaleName: 'ELO',
      value: 1700,
    });
  });
});

describe('parseRatingCell — no match', () => {
  it('returns null for plain numeric without a default scale', () => {
    expect(parseRatingCell('4.5')).toBeNull();
  });

  it('returns null for empty / whitespace / nullish input', () => {
    expect(parseRatingCell('')).toBeNull();
    expect(parseRatingCell('   ')).toBeNull();
    expect(parseRatingCell(null)).toBeNull();
    expect(parseRatingCell(undefined)).toBeNull();
  });

  it('returns null for unrecognized text without a default scale', () => {
    expect(parseRatingCell('not a rating')).toBeNull();
  });

  it('returns null for non-numeric text even with a default scale', () => {
    expect(parseRatingCell('great', { defaultScaleName: 'NTRP' })).toBeNull();
  });

  it('accepts numeric input directly', () => {
    expect(parseRatingCell(8.5, { defaultScaleName: 'UTR' })).toEqual({
      scaleName: 'UTR',
      value: 8.5,
    });
  });
});
