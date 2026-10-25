import type { TransitInputs } from './transitModel';
import { describe, expect, it } from 'vitest';
import {
  directedTransit,
  formatMinutes,
  layoutVenues,
  policyDefaultTransitMinutes,
  transitEdges,
  transitInputsFromRecord,
  validateTransitMinutes,
} from './transitModel';

const venues = [
  { venueId: 'a', name: 'Riverside' },
  { venueId: 'b', name: 'Northside' },
  { venueId: 'c', name: 'Eastfield' },
];

describe('directedTransit mirrors the factory lookup (scheduling-pipeline.md § 3.4)', () => {
  it('a stated pair applies both ways', () => {
    const inputs: TransitInputs = { venues, entries: [{ venueIds: ['a', 'b'], minutes: 45 }] };
    expect(directedTransit(inputs, 'a', 'b')).toMatchObject({ minutes: 45, source: 'stated' });
    expect(directedTransit(inputs, 'b', 'a')).toMatchObject({ minutes: 45, source: 'stated' });
  });

  it('a one-way value applies its way only; the other way falls to the default', () => {
    const inputs: TransitInputs = {
      venues,
      entries: [{ venueIds: ['b', 'a'], minutes: 60, oneWay: true }],
      defaultMinutes: 30,
    };
    expect(directedTransit(inputs, 'b', 'a')).toMatchObject({ minutes: 60, source: 'stated' });
    expect(directedTransit(inputs, 'a', 'b')).toMatchObject({ minutes: 30, source: 'default' });
  });

  it('where a symmetric and a one-way value both apply, the greater wins', () => {
    const inputs: TransitInputs = {
      venues,
      entries: [
        { venueIds: ['a', 'b'], minutes: 30 },
        { venueIds: ['b', 'a'], minutes: 60, oneWay: true },
      ],
    };
    expect(directedTransit(inputs, 'b', 'a').minutes).toEqual(60);
    expect(directedTransit(inputs, 'a', 'b').minutes).toEqual(30);
  });

  it('a sanctioned value is reported as such', () => {
    const inputs: TransitInputs = {
      venues,
      entries: [{ venueIds: ['a', 'b'], minutes: 40, sanctioned: { minutes: 40 } }],
    };
    expect(directedTransit(inputs, 'a', 'b')).toMatchObject({ minutes: 40, source: 'sanctioned' });
  });

  it('venues sharing a facility need none, whatever the default; a stated value still wins', () => {
    const shared = venues.map((venue) => (venue.venueId === 'c' ? venue : { ...venue, facilityId: 'f1' }));
    expect(directedTransit({ venues: shared, entries: [], defaultMinutes: 30 }, 'a', 'b')).toMatchObject({
      minutes: 0,
      source: 'facility',
    });
    expect(
      directedTransit({ venues: shared, entries: [{ venueIds: ['a', 'b'], minutes: 5 }] }, 'a', 'b').source,
    ).toEqual('stated');
  });

  it('with no policy default there is no transit; the same venue never has any', () => {
    expect(directedTransit({ venues, entries: [] }, 'a', 'b')).toMatchObject({ minutes: 0, source: 'none' });
    expect(directedTransit({ venues, entries: [], defaultMinutes: 30 }, 'a', 'a').source).toEqual('none');
  });
});

describe('transitEdges', () => {
  it('one edge per pair, symmetric unless the directions differ', () => {
    const edges = transitEdges({
      venues,
      entries: [
        { venueIds: ['a', 'b'], minutes: 45 },
        { venueIds: ['a', 'c'], minutes: 20, oneWay: true },
      ],
      defaultMinutes: 30,
    });
    expect(edges.map(({ from, to, symmetric }) => [from, to, symmetric])).toEqual([
      ['a', 'b', true],
      ['a', 'c', false],
      ['b', 'c', true],
    ]);
  });
});

describe('layoutVenues', () => {
  it('places unlocated venues on a circle inside the box', () => {
    const positions = layoutVenues(venues, 400, 300);
    for (const { x, y } of Object.values(positions)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(400);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(300);
    }
    expect(new Set(Object.values(positions).map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`)).size).toEqual(3);
  });

  it('projects located venues so north is up and west is left', () => {
    const located = [
      { venueId: 'north', name: 'N', latitude: 40.8, longitude: -74.0 },
      { venueId: 'south', name: 'S', latitude: 40.6, longitude: -74.0 },
      { venueId: 'west', name: 'W', latitude: 40.7, longitude: -74.2 },
    ];
    const positions = layoutVenues(located, 400, 400);
    expect(positions.north.y).toBeLessThan(positions.south.y);
    expect(positions.west.x).toBeLessThan(positions.north.x);
  });

  it('gathers venues of one facility close together', () => {
    const clustered = [
      { venueId: 'a', name: 'A', facilityId: 'f1' },
      { venueId: 'b', name: 'B', facilityId: 'f1' },
      { venueId: 'c', name: 'C' },
      { venueId: 'd', name: 'D' },
    ];
    const positions = layoutVenues(clustered, 400, 400);
    const distance = (p: string, q: string) =>
      Math.hypot(positions[p].x - positions[q].x, positions[p].y - positions[q].y);
    expect(distance('a', 'b')).toBeLessThan(distance('c', 'd'));
  });
});

describe('validateTransitMinutes', () => {
  it('accepts whole non-negative minutes', () => {
    expect(validateTransitMinutes(' 45 ')).toEqual({ minutes: 45 });
    expect(validateTransitMinutes('0')).toEqual({ minutes: 0 });
  });

  it('refuses fractions, signs and text', () => {
    for (const value of ['7.5', '-5', 'ten', '']) expect(validateTransitMinutes(value).error).toEqual('notWhole');
  });

  it('refuses a value below the sanctioned floor', () => {
    expect(validateTransitMinutes('35', 40).error).toEqual('belowSanctioned');
    expect(validateTransitMinutes('40', 40)).toEqual({ minutes: 40 });
  });
});

describe('reading the record', () => {
  it('maps venues, coordinates and the stored pairs; reads the policy default', () => {
    const record = {
      venues: [
        { venueId: 'a', venueName: 'Riverside', facilityId: 'f1', addresses: [{ latitude: '40.7', longitude: '-74' }] },
        { venueId: 'b', venueName: 'Northside', addresses: [{}] },
      ],
      scheduling: { venueTransits: [{ venueIds: ['a', 'b'], minutes: 45 }] },
    };
    const inputs = transitInputsFromRecord(
      record,
      policyDefaultTransitMinutes({ scheduling: { defaultTimes: { transitMinutes: 30 } } }),
    );
    expect(inputs.venues).toEqual([
      { venueId: 'a', name: 'Riverside', facilityId: 'f1', latitude: 40.7, longitude: -74, abbreviation: undefined },
      { venueId: 'b', name: 'Northside', abbreviation: undefined, facilityId: undefined },
    ]);
    expect(inputs.entries).toEqual([{ venueIds: ['a', 'b'], minutes: 45 }]);
    expect(inputs.defaultMinutes).toEqual(30);
    expect(policyDefaultTransitMinutes({})).toBeUndefined();
  });
});

describe('formatMinutes', () => {
  it('reads as minutes, then hours and minutes', () => {
    expect([formatMinutes(0), formatMinutes(45), formatMinutes(60), formatMinutes(75), formatMinutes(120)]).toEqual([
      '0m',
      '45m',
      '1h',
      '1h 15m',
      '2h',
    ]);
  });
});
