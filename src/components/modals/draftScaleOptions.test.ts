import { describe, expect, it } from 'vitest';
import {
  getTournamentScaleOptions,
  getParticipantScaleValues,
  resolveScaleDisplayValue,
  previewTierSort,
} from './draftScaleOptions';

describe('getTournamentScaleOptions', () => {
  it('returns empty array when no participants', () => {
    expect(getTournamentScaleOptions([])).toEqual([]);
  });

  it('returns empty array when participants have no scales', () => {
    const participants = [{ ratings: {}, rankings: {} }, {}];
    expect(getTournamentScaleOptions(participants)).toEqual([]);
  });

  it('discovers rating scale names from participants', () => {
    const participants = [
      { ratings: { SINGLES: [{ scaleName: 'DUPR' }, { scaleName: 'WTN' }] } },
      { ratings: { SINGLES: [{ scaleName: 'DUPR' }] } },
    ];
    const options = getTournamentScaleOptions(participants, 'SINGLES');
    expect(options).toEqual([
      { label: 'Rating: DUPR', value: 'DUPR', scaleType: 'RATING' },
      { label: 'Rating: WTN', value: 'WTN', scaleType: 'RATING' },
    ]);
  });

  it('discovers ranking scale names from participants', () => {
    const participants = [{ rankings: { SINGLES: [{ scaleName: 'U18' }] } }];
    const options = getTournamentScaleOptions(participants, 'SINGLES');
    expect(options).toEqual([{ label: 'Ranking: U18', value: 'U18', scaleType: 'RANKING' }]);
  });

  it('returns both ratings and rankings, ratings first', () => {
    const participants = [
      {
        ratings: { SINGLES: [{ scaleName: 'WTN' }] },
        rankings: { SINGLES: [{ scaleName: 'National' }] },
      },
    ];
    const options = getTournamentScaleOptions(participants, 'SINGLES');
    expect(options).toHaveLength(2);
    expect(options[0].scaleType).toBe('RATING');
    expect(options[1].scaleType).toBe('RANKING');
  });

  it('sorts alphabetically within each group', () => {
    const participants = [
      { ratings: { SINGLES: [{ scaleName: 'WTN' }, { scaleName: 'DUPR' }, { scaleName: 'ELO' }] } },
    ];
    const options = getTournamentScaleOptions(participants, 'SINGLES');
    expect(options.map((o) => o.value)).toEqual(['DUPR', 'ELO', 'WTN']);
  });

  it('collects across all event types when eventType is omitted', () => {
    const participants = [
      {
        ratings: {
          SINGLES: [{ scaleName: 'WTN' }],
          DOUBLES: [{ scaleName: 'DUPR' }],
        },
      },
    ];
    const options = getTournamentScaleOptions(participants);
    expect(options.map((o) => o.value)).toEqual(['DUPR', 'WTN']);
  });

  it('deduplicates across participants', () => {
    const participants = [
      { ratings: { SINGLES: [{ scaleName: 'WTN' }] } },
      { ratings: { SINGLES: [{ scaleName: 'WTN' }] } },
      { ratings: { SINGLES: [{ scaleName: 'WTN' }] } },
    ];
    const options = getTournamentScaleOptions(participants, 'SINGLES');
    expect(options).toHaveLength(1);
  });
});

describe('resolveScaleDisplayValue', () => {
  it('returns undefined for null/undefined', () => {
    expect(resolveScaleDisplayValue(null)).toBeUndefined();
    expect(resolveScaleDisplayValue(undefined)).toBeUndefined();
  });

  it('returns string for primitive values', () => {
    expect(resolveScaleDisplayValue(4.5)).toBe('4.5');
    expect(resolveScaleDisplayValue(0)).toBe('0');
    expect(resolveScaleDisplayValue('hello')).toBe('hello');
  });

  it('resolves object values via accessor', () => {
    expect(resolveScaleDisplayValue({ duprRating: 4.5, reliabilityScore: 80 }, 'duprRating')).toBe('4.5');
    expect(resolveScaleDisplayValue({ wtnRating: 23.5, confidence: 90 }, 'wtnRating')).toBe('23.5');
  });

  it('returns undefined for object without matching accessor', () => {
    expect(resolveScaleDisplayValue({ duprRating: 4.5 }, 'wtnRating')).toBeUndefined();
    expect(resolveScaleDisplayValue({ duprRating: 4.5 })).toBeUndefined();
  });

  it('handles zero values in accessor', () => {
    expect(resolveScaleDisplayValue({ rating: 0 }, 'rating')).toBe('0');
  });
});

describe('getParticipantScaleValues', () => {
  it('returns empty map when no participants', () => {
    expect(getParticipantScaleValues([], 'RATING', 'DUPR')).toEqual(new Map());
  });

  it('extracts primitive rating values by scale name', () => {
    const participants = [
      { participantId: 'p1', ratings: { SINGLES: [{ scaleName: 'ELO', scaleValue: 1500 }] } },
      { participantId: 'p2', ratings: { SINGLES: [{ scaleName: 'ELO', scaleValue: 1200 }] } },
    ];
    const map = getParticipantScaleValues(participants, 'RATING', 'ELO', 'SINGLES');
    expect(map.get('p1')).toBe('1500');
    expect(map.get('p2')).toBe('1200');
  });

  it('resolves object scale values via accessor', () => {
    const participants = [
      { participantId: 'p1', ratings: { SINGLES: [{ scaleName: 'DUPR', scaleValue: { duprRating: 4.5, reliabilityScore: 80 } }] } },
      { participantId: 'p2', ratings: { SINGLES: [{ scaleName: 'DUPR', scaleValue: { duprRating: 3.2, reliabilityScore: 60 } }] } },
      { participantId: 'p3', ratings: { SINGLES: [{ scaleName: 'WTN', scaleValue: { wtnRating: 20 } }] } },
    ];
    const map = getParticipantScaleValues(participants, 'RATING', 'DUPR', 'SINGLES', 'duprRating');
    expect(map.size).toBe(2);
    expect(map.get('p1')).toBe('4.5');
    expect(map.get('p2')).toBe('3.2');
    expect(map.has('p3')).toBe(false);
  });

  it('extracts ranking values', () => {
    const participants = [
      { participantId: 'p1', rankings: { SINGLES: [{ scaleName: 'U18', scaleValue: 5 }] } },
    ];
    const map = getParticipantScaleValues(participants, 'RANKING', 'U18', 'SINGLES');
    expect(map.get('p1')).toBe('5');
  });

  it('skips participants without participantId', () => {
    const participants = [{ ratings: { SINGLES: [{ scaleName: 'DUPR', scaleValue: 4 }] } }];
    const map = getParticipantScaleValues(participants, 'RATING', 'DUPR', 'SINGLES');
    expect(map.size).toBe(0);
  });

  it('skips null/undefined scale values', () => {
    const participants = [
      { participantId: 'p1', ratings: { SINGLES: [{ scaleName: 'DUPR', scaleValue: null }] } },
      { participantId: 'p2', ratings: { SINGLES: [{ scaleName: 'DUPR' }] } },
    ];
    const map = getParticipantScaleValues(participants, 'RATING', 'DUPR', 'SINGLES');
    expect(map.size).toBe(0);
  });

  it('skips object values when accessor does not match', () => {
    const participants = [
      { participantId: 'p1', ratings: { SINGLES: [{ scaleName: 'DUPR', scaleValue: { duprRating: 4.5 } }] } },
    ];
    const map = getParticipantScaleValues(participants, 'RATING', 'DUPR', 'SINGLES', 'wtnRating');
    expect(map.size).toBe(0);
  });

  it('converts numeric values to strings', () => {
    const participants = [
      { participantId: 'p1', ratings: { SINGLES: [{ scaleName: 'ELO', scaleValue: 0 }] } },
    ];
    const map = getParticipantScaleValues(participants, 'RATING', 'ELO', 'SINGLES');
    expect(map.get('p1')).toBe('0');
  });
});

describe('previewTierSort', () => {
  const scaleValues = new Map([
    ['p1', '4.5'],
    ['p2', '3.2'],
    ['p3', '5.0'],
    ['p4', '2.8'],
  ]);

  it('ascending=false puts highest values in tier 1', () => {
    const tiers = previewTierSort(['p1', 'p2', 'p3', 'p4'], scaleValues, false, 2);
    expect(tiers).toHaveLength(2);
    // Tier 1: p3 (5.0), p1 (4.5); Tier 2: p2 (3.2), p4 (2.8)
    expect(tiers[0].participantIds).toEqual(['p3', 'p1']);
    expect(tiers[1].participantIds).toEqual(['p2', 'p4']);
  });

  it('ascending=true puts lowest values in tier 1', () => {
    const tiers = previewTierSort(['p1', 'p2', 'p3', 'p4'], scaleValues, true, 2);
    // Tier 1: p4 (2.8), p2 (3.2); Tier 2: p1 (4.5), p3 (5.0)
    expect(tiers[0].participantIds).toEqual(['p4', 'p2']);
    expect(tiers[1].participantIds).toEqual(['p1', 'p3']);
  });

  it('participants without values go to last tier', () => {
    const tiers = previewTierSort(['p1', 'p2', 'p5'], scaleValues, false, 2);
    // p5 has no value → goes after sorted
    // 3 into 2 tiers: 2+1. Tier 1: p1 (4.5), p2 (3.2); Tier 2: p5
    expect(tiers[0].participantIds).toEqual(['p1', 'p2']);
    expect(tiers[1].participantIds).toEqual(['p5']);
  });

  it('handles empty participant list', () => {
    const tiers = previewTierSort([], scaleValues, false, 3);
    expect(tiers).toEqual([]);
  });

  it('distributes remainder evenly (earlier tiers get extra)', () => {
    const five = new Map([
      ['a', '5'],
      ['b', '4'],
      ['c', '3'],
      ['d', '2'],
      ['e', '1'],
    ]);
    const tiers = previewTierSort(['a', 'b', 'c', 'd', 'e'], five, false, 3);
    // 5 / 3 = 1 remainder 2 → first 2 tiers get 2 each, last gets 1
    expect(tiers[0].participantIds).toHaveLength(2);
    expect(tiers[1].participantIds).toHaveLength(2);
    expect(tiers[2].participantIds).toHaveLength(1);
  });
});
