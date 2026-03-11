import { describe, expect, it } from 'vitest';
import { scoreSorter } from './scoreSorter';
import { participantSorter } from './participantSorter';
import { percentSorter } from './percentSorter';
import { orderSorter } from './orderSorter';
import { competitiveProfileSorter } from './competitiveProfileSorter';
import { getConfidenceBand, confidenceBands } from './ratingSorter';

describe('scoreSorter', () => {
  it('scored matchups sort before unscored', () => {
    expect(scoreSorter({ score: '6-4' }, { score: undefined })).toBe(-1);
    expect(scoreSorter({ score: undefined }, { score: '6-4' })).toBe(1);
  });

  it('both scored returns 0', () => {
    expect(scoreSorter({ score: '6-4' }, { score: '7-5' })).toBe(0);
  });

  it('both unscored, readyToScore sorts first', () => {
    expect(scoreSorter({ readyToScore: true }, { readyToScore: false })).toBe(-1);
    expect(scoreSorter({ readyToScore: false }, { readyToScore: true })).toBe(1);
  });

  it('both unscored both not ready returns 0', () => {
    expect(scoreSorter({}, {})).toBe(0);
  });

  it('both unscored both ready returns 0', () => {
    expect(scoreSorter({ readyToScore: true }, { readyToScore: true })).toBe(0);
  });
});

describe('participantSorter', () => {
  it('sorts by standardFamilyName when both have it', () => {
    const a = { person: { standardFamilyName: 'Adams' } };
    const b = { person: { standardFamilyName: 'Baker' } };
    expect(participantSorter(a, b)).toBeLessThan(0);
    expect(participantSorter(b, a)).toBeGreaterThan(0);
  });

  it('same family name returns 0', () => {
    const a = { person: { standardFamilyName: 'Smith' } };
    const b = { person: { standardFamilyName: 'Smith' } };
    expect(participantSorter(a, b)).toBe(0);
  });

  it('falls back to participantName', () => {
    const a = { participantName: 'Adams, John' };
    const b = { participantName: 'Baker, Jane' };
    expect(participantSorter(a, b)).toBeLessThan(0);
  });

  it('returns 1 when both have no name', () => {
    expect(participantSorter({}, {})).toBe(1);
  });

  it('accesses person from nested participant', () => {
    const a = { participant: { person: { standardFamilyName: 'Adams' } } };
    const b = { participant: { person: { standardFamilyName: 'Baker' } } };
    expect(participantSorter(a, b)).toBeLessThan(0);
  });
});

describe('percentSorter', () => {
  it('sorts descending (higher first)', () => {
    expect(percentSorter(90, 80)).toBeLessThan(0);
    expect(percentSorter(80, 90)).toBeGreaterThan(0);
  });

  it('equal values return 0', () => {
    expect(percentSorter(50, 50)).toBe(0);
  });

  it('falsy values sort to end', () => {
    expect(percentSorter(50, 0)).toBe(-1);
    expect(percentSorter(0, 50)).toBe(1);
  });

  it('both falsy returns -1', () => {
    expect(percentSorter(0, 0)).toBe(-1);
  });
});

describe('orderSorter', () => {
  it('sorts ascending (lower first)', () => {
    expect(orderSorter(1, 5)).toBeLessThan(0);
    expect(orderSorter(5, 1)).toBeGreaterThan(0);
  });

  it('equal values return 0', () => {
    expect(orderSorter(3, 3)).toBe(0);
  });

  it('falsy values sort to end', () => {
    expect(orderSorter(3, 0)).toBe(-1);
    expect(orderSorter(0, 3)).toBe(1);
  });

  it('both falsy returns -1', () => {
    expect(orderSorter(0, 0)).toBe(-1);
  });
});

describe('competitiveProfileSorter', () => {
  it('sorts by pctSpread descending', () => {
    expect(competitiveProfileSorter({ pctSpread: 80 }, { pctSpread: 60 })).toBeLessThan(0);
    expect(competitiveProfileSorter({ pctSpread: 60 }, { pctSpread: 80 })).toBeGreaterThan(0);
  });

  it('items with pctSpread sort before those without', () => {
    expect(competitiveProfileSorter({ pctSpread: 50 }, {})).toBe(-1);
    expect(competitiveProfileSorter({}, { pctSpread: 50 })).toBe(1);
  });

  it('both without pctSpread returns 0', () => {
    expect(competitiveProfileSorter({}, {})).toBe(0);
  });

  it('equal spread returns 0', () => {
    expect(competitiveProfileSorter({ pctSpread: 50 }, { pctSpread: 50 })).toBe(0);
  });
});

describe('getConfidenceBand', () => {
  it('returns high for values >= 80', () => {
    expect(getConfidenceBand(80)).toBe('high');
    expect(getConfidenceBand(95)).toBe('high');
    expect(getConfidenceBand(100)).toBe('high');
  });

  it('returns medium for values >= 60 and < 80', () => {
    expect(getConfidenceBand(60)).toBe('medium');
    expect(getConfidenceBand(75)).toBe('medium');
    expect(getConfidenceBand(79)).toBe('medium');
  });

  it('returns low for values >= 40 and < 60', () => {
    expect(getConfidenceBand(40)).toBe('low');
    expect(getConfidenceBand(55)).toBe('low');
    expect(getConfidenceBand(59)).toBe('low');
  });

  it('returns unrated for values < 40', () => {
    expect(getConfidenceBand(0)).toBe('unrated');
    expect(getConfidenceBand(39)).toBe('unrated');
  });

  it('handles string values', () => {
    expect(getConfidenceBand('85')).toBe('high');
    expect(getConfidenceBand('65')).toBe('medium');
  });

  it('confidence bands have correct ranges', () => {
    expect(confidenceBands.high).toEqual([80, 100]);
    expect(confidenceBands.medium).toEqual([60, 80]);
    expect(confidenceBands.low).toEqual([40, 60]);
  });
});
