import { resolveScaleValueNumber, hasScaleValueNumber } from './resolveScaleValueNumber';
import { expect, it, describe } from 'vitest';

/**
 * Shapes copied from production records (ITA regional championships), not
 * invented. mocksEngine emits numbers, so the string and empty-string cases —
 * the two that were producing wrong output — cannot be reached by any
 * generated fixture.
 */

describe('resolveScaleValueNumber', () => {
  it('reads a numeric string, which is how ingested records store ratings', () => {
    expect(resolveScaleValueNumber('12.48')).toBe(12.48);
    expect(resolveScaleValueNumber({ utrRating: '12.48' }, { scaleName: 'UTR' })).toBe(12.48);
  });

  it('rejects an empty string rather than reading it as zero', () => {
    // `Number('')` is 0, and 0 on UTR's [1,16] range is below the floor.
    expect(resolveScaleValueNumber('')).toBeUndefined();
    expect(resolveScaleValueNumber({ utrRating: '' }, { scaleName: 'UTR' })).toBeUndefined();
    expect(hasScaleValueNumber({ utrRating: '' }, { scaleName: 'UTR' })).toBe(false);
  });

  it('preserves a legitimate zero', () => {
    // PSA, SQUASH_LEVELS, ITTF and BWF all declare 0 inside their valid range.
    expect(resolveScaleValueNumber(0)).toBe(0);
    expect(resolveScaleValueNumber('0')).toBe(0);
    expect(hasScaleValueNumber(0)).toBe(true);
  });

  it('takes the rating rather than a sibling attribute for a multi-property scale', () => {
    expect(resolveScaleValueNumber({ confidence: 90, wtnRating: 4.13 }, { scaleName: 'WTN' })).toBe(4.13);
  });

  it('rejects nullish, non-numeric and NaN values without coercing them', () => {
    for (const value of [null, undefined, 'unrated', Number.NaN, {}, [], true]) {
      expect(resolveScaleValueNumber(value)).toBeUndefined();
    }
  });
});
