import { ratingSorter } from './ratingSorter';
import { expect, it, describe } from 'vitest';

/**
 * `ratingSorter` had no coverage. The value shapes here come from production
 * records (ITA regional championships): ratings stored as STRINGS, an EMPTY
 * STRING for a participant with no rating on that scale, and a legitimate ZERO.
 *
 * Rows share a confidence so the comparator reaches the rating at all — it
 * bands confidence first and only falls through to the rating on a tie.
 */

const CONFIDENCE = 90;

const utrRow = (utrRating: unknown) => ({ utrRating, confidence: CONFIDENCE });
const wtnRow = (wtnRating: unknown) => ({ wtnRating, confidence: CONFIDENCE });

/** Apply the sorter the way a table would, and report the resulting order. */
function order<T extends Record<string, any>>(scale: string, rows: (T & { id: string })[]): string[] {
  return [...rows].sort(ratingSorter(scale)).map((row) => row.id);
}

describe('ratingSorter — value handling', () => {
  it('reads STRING ratings, which is how ingested records store them', () => {
    const result = order('UTR', [
      { id: 'strong', ...utrRow('13.90') },
      { id: 'weak', ...utrRow('9.20') },
      { id: 'mid', ...utrRow('11.50') },
    ]);
    // UTR is descending-is-better, so the comparator's natural order is
    // weakest first; the table reverses for the other direction.
    expect(result).toEqual(['weak', 'mid', 'strong']);
  });

  it('orders string and number representations identically', () => {
    const asStrings = order('UTR', [
      { id: 'a', ...utrRow('13.90') },
      { id: 'b', ...utrRow('9.20') },
    ]);
    const asNumbers = order('UTR', [
      { id: 'a', ...utrRow(13.9) },
      { id: 'b', ...utrRow(9.2) },
    ]);
    expect(asStrings).toEqual(asNumbers);
  });
});

describe('ratingSorter — unrated rows', () => {
  it('sorts an unrated row LAST on a descending-is-better scale', () => {
    // Before, `|| 0` gave the unrated row 0, which on UTR sorted it FIRST.
    const result = order('UTR', [
      { id: 'unrated', ...utrRow('') },
      { id: 'strong', ...utrRow('13.90') },
      { id: 'weak', ...utrRow('9.20') },
    ]);
    expect(result.at(-1)).toBe('unrated');
  });

  it('sorts an unrated row LAST on an ascending-is-better scale too', () => {
    // The old `|| 0` put unrated at opposite ends depending on the scale, so
    // the same "no rating" state read differently in two columns.
    const result = order('WTN', [
      { id: 'unrated', ...wtnRow('') },
      { id: 'strong', ...wtnRow('4.13') },
      { id: 'weak', ...wtnRow('18.90') },
    ]);
    expect(result.at(-1)).toBe('unrated');
  });

  it('treats a missing accessor and a non-numeric value as unrated', () => {
    for (const value of [undefined, null, 'unrated']) {
      const result = order('UTR', [
        { id: 'unrated', ...utrRow(value) },
        { id: 'rated', ...utrRow('11.50') },
      ]);
      expect(result.at(-1)).toBe('unrated');
    }
  });

  it('keeps two unrated rows stable relative to each other', () => {
    const result = order('UTR', [
      { id: 'first', ...utrRow('') },
      { id: 'second', ...utrRow(undefined) },
    ]);
    expect(result).toEqual(['first', 'second']);
  });
});

describe('ratingSorter — a legitimate zero is a rating, not an absence', () => {
  it('ranks a zero-rated row above an unrated one', () => {
    // PSA declares range [0, 3000]; `|| 0` collapsed a real 0 into the same
    // bucket as no rating at all.
    const result = order('PSA', [
      { id: 'unrated', psaPoints: '', confidence: CONFIDENCE },
      { id: 'zero', psaPoints: 0, confidence: CONFIDENCE },
      { id: 'strong', psaPoints: 900, confidence: CONFIDENCE },
    ]);
    expect(result).toEqual(['zero', 'strong', 'unrated']);
  });
});

describe('ratingSorter — confidence still wins', () => {
  it('bands by confidence before considering the rating', () => {
    const result = order('UTR', [
      { id: 'lowConfidenceStrong', utrRating: '13.90', confidence: 45 },
      { id: 'highConfidenceWeak', utrRating: '9.20', confidence: 95 },
    ]);
    expect(result[0]).toBe('highConfidenceWeak');
  });

  it('returns 0 for an unknown scale rather than reordering', () => {
    const result = order('NOT_A_SCALE', [
      { id: 'a', utrRating: '9.20', confidence: CONFIDENCE },
      { id: 'b', utrRating: '13.90', confidence: CONFIDENCE },
    ]);
    expect(result).toEqual(['a', 'b']);
  });
});
