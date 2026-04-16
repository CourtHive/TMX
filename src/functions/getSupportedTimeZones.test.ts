import { describe, expect, it } from 'vitest';
import { getSupportedTimeZones, isValidTimeZone } from './getSupportedTimeZones';

describe('getSupportedTimeZones', () => {
  it('returns a non-empty, alphabetically-sorted array', () => {
    const zones = getSupportedTimeZones();
    expect(Array.isArray(zones)).toBe(true);
    expect(zones.length).toBeGreaterThan(10);
    const sorted = [...zones].sort((a, b) => a.localeCompare(b));
    expect(zones).toEqual(sorted);
  });

  it('includes the canonical tournament zones we curated as fallback', () => {
    const zones = getSupportedTimeZones();
    expect(zones).toContain('UTC');
    expect(zones).toContain('America/New_York');
    expect(zones).toContain('Europe/London');
    expect(zones).toContain('Asia/Tokyo');
  });

  it('returns a fresh array (caller mutations do not leak into the next call)', () => {
    const first = getSupportedTimeZones();
    first.push('MADE_UP');
    const second = getSupportedTimeZones();
    expect(second).not.toContain('MADE_UP');
  });
});

describe('isValidTimeZone', () => {
  it('accepts known IANA zones', () => {
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('America/New_York')).toBe(true);
    expect(isValidTimeZone('Europe/London')).toBe(true);
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
  });

  it('accepts zones with surrounding whitespace (trims internally)', () => {
    expect(isValidTimeZone('  America/Chicago  ')).toBe(true);
  });

  it('rejects unrecognised zones', () => {
    expect(isValidTimeZone('Narnia/Cair_Paravel')).toBe(false);
    expect(isValidTimeZone('america/new york')).toBe(false); // space not underscore
  });

  it('rejects falsy / non-string input', () => {
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone('   ')).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
    expect(isValidTimeZone({})).toBe(false);
  });
});
