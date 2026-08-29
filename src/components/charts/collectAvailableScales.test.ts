import { collectAvailableScales } from './collectAvailableScales';
import { expect, it, describe } from 'vitest';

/**
 * `collectAvailableScales` feeds the rating-distribution chart on the overview
 * and participants tabs. It had no coverage, and the values it collects were
 * being fabricated: `Number('')` is 0 and `Number.isFinite(0)` is true, so every
 * participant with no rating on a scale contributed a 0 to that scale's
 * distribution — moving its min, mean, stddev and binning.
 *
 * Shapes below come from production records (ITA regional championships).
 */

const participant = (ratings: any[]) => ({ ratings: { SINGLES: ratings } });
const utr = (utrRating: unknown) => ({ scaleName: 'UTR', scaleValue: { utrRating } });

function valuesFor(result: ReturnType<typeof collectAvailableScales>, scaleName: string): number[] {
  return result.find((entry) => entry.scaleName === scaleName)?.values ?? [];
}

describe('collectAvailableScales', () => {
  it('reads STRING ratings, which is how ingested records store them', () => {
    const result = collectAvailableScales([participant([utr('12.48')]), participant([utr('9.20')])]);
    expect(valuesFor(result, 'UTR')).toEqual([12.48, 9.2]);
  });

  it('EXCLUDES an empty-string rating instead of contributing a zero', () => {
    // The defect: '' became 0 and entered the distribution as a real rating a
    // full unit below UTR's [1,16] floor.
    const result = collectAvailableScales([
      participant([utr('12.48')]),
      participant([utr('')]),
      participant([utr('9.20')]),
    ]);
    expect(valuesFor(result, 'UTR')).toEqual([12.48, 9.2]);
    expect(valuesFor(result, 'UTR')).not.toContain(0);
  });

  it('keeps a legitimate zero on a scale whose range includes it', () => {
    const result = collectAvailableScales([
      participant([{ scaleName: 'PSA', scaleValue: { psaPoints: 0 } }]),
      participant([{ scaleName: 'PSA', scaleValue: { psaPoints: 900 } }]),
    ]);
    expect(valuesFor(result, 'PSA')).toEqual([0, 900]);
  });

  it('gives string and number representations the same distribution', () => {
    const asStrings = collectAvailableScales([participant([utr('12.48')]), participant([utr('9.20')])]);
    const asNumbers = collectAvailableScales([participant([utr(12.48)]), participant([utr(9.2)])]);
    expect(valuesFor(asStrings, 'UTR')).toEqual(valuesFor(asNumbers, 'UTR'));
  });

  it('takes the rating rather than a sibling attribute on a multi-property scale', () => {
    const result = collectAvailableScales([
      participant([{ scaleName: 'WTN', scaleValue: { confidence: 90, wtnRating: '4.13' } }]),
    ]);
    expect(valuesFor(result, 'WTN')).toEqual([4.13]);
  });

  it('groups by scale and tolerates participants with no ratings at all', () => {
    const result = collectAvailableScales([
      participant([utr('12.48'), { scaleName: 'WTN', scaleValue: { wtnRating: '4.13' } }]),
      { participantId: 'no-ratings' },
      participant([]),
    ] as any);
    expect(valuesFor(result, 'UTR')).toEqual([12.48]);
    expect(valuesFor(result, 'WTN')).toEqual([4.13]);
  });

  it('omits a scale entirely when nothing on it resolves', () => {
    const result = collectAvailableScales([participant([utr('')]), participant([utr('unrated')])]);
    expect(result.find((entry) => entry.scaleName === 'UTR')).toBeUndefined();
  });
});
