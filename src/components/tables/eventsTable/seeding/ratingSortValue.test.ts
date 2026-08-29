import { ratingSortValue } from './ratingSortValue';
import { expect, it, describe } from 'vitest';

const WTN = { scaleName: 'WTN', accessor: 'wtnRating', reversed: true }; // lower is stronger
const UTR = { scaleName: 'UTR', accessor: 'utrRating', reversed: false }; // higher is stronger

/** Order a field the way the seeding comparator does, strongest first. */
function seedOrder(entries: { id: string; rawValue: unknown }[], scale: typeof WTN) {
  return entries
    .map((entry) => ({ ...entry, sortValue: ratingSortValue({ ...scale, rawValue: entry.rawValue }) }))
    .toSorted((a, b) => (scale.reversed ? a.sortValue - b.sortValue : b.sortValue - a.sortValue))
    .map((entry) => entry.id);
}

describe('ratingSortValue', () => {
  it('reads a numeric string, which is how ingested records store ratings', () => {
    expect(ratingSortValue({ ...UTR, rawValue: '12.48' })).toBe(12.48);
  });

  it('preserves a legitimate zero rather than treating it as unrated', () => {
    expect(ratingSortValue({ ...UTR, rawValue: 0 })).toBe(0);
    expect(ratingSortValue({ ...UTR, rawValue: '0' })).toBe(0);
  });

  it('sinks an unresolvable value in BOTH sort directions', () => {
    for (const rawValue of ['', '   ', null, undefined, 'unrated']) {
      expect(ratingSortValue({ ...WTN, rawValue })).toBe(Number.POSITIVE_INFINITY);
      expect(ratingSortValue({ ...UTR, rawValue })).toBe(Number.NEGATIVE_INFINITY);
    }
  });
});

describe('seeding order — the defect this prevents', () => {
  it('does NOT seed an unrated participant first on an ascending scale', () => {
    // The regression. `'' || 0` gave 0, and on WTN (lower is stronger) 0 sorts
    // ahead of the best real rating — so the unrated player was seeded #1.
    const order = seedOrder(
      [
        { id: 'unrated', rawValue: '' },
        { id: 'strong', rawValue: '4.13' },
        { id: 'weak', rawValue: '18.90' },
      ],
      WTN,
    );
    expect(order[0]).toBe('strong');
    expect(order.at(-1)).toBe('unrated');
  });

  it('does not seed an unrated participant first on a descending scale either', () => {
    const order = seedOrder(
      [
        { id: 'unrated', rawValue: '' },
        { id: 'strong', rawValue: '13.90' },
        { id: 'weak', rawValue: '9.20' },
      ],
      UTR,
    );
    expect(order[0]).toBe('strong');
    expect(order.at(-1)).toBe('unrated');
  });

  it('seeds a participant rated exactly zero as the weakest, not as unrated', () => {
    // On a descending scale 0 is the floor but still a real rating; it must sit
    // above anyone with no rating at all.
    const order = seedOrder(
      [
        { id: 'zero', rawValue: 0 },
        { id: 'unrated', rawValue: '' },
        { id: 'strong', rawValue: 900 },
      ],
      { scaleName: 'PSA', accessor: 'psaPoints', reversed: false },
    );
    expect(order).toEqual(['strong', 'zero', 'unrated']);
  });

  it('orders string and number representations identically', () => {
    const asStrings = seedOrder(
      [
        { id: 'a', rawValue: '12.48' },
        { id: 'b', rawValue: '9.20' },
        { id: 'c', rawValue: '13.90' },
      ],
      UTR,
    );
    const asNumbers = seedOrder(
      [
        { id: 'a', rawValue: 12.48 },
        { id: 'b', rawValue: 9.2 },
        { id: 'c', rawValue: 13.9 },
      ],
      UTR,
    );
    expect(asStrings).toEqual(asNumbers);
    expect(asStrings).toEqual(['c', 'a', 'b']);
  });
});
