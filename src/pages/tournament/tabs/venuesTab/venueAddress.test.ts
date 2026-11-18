import { buildVenueAddress, defaultVenueTimeZone, readVenueTimeZone } from './venueAddress';
import { describe, expect, it } from 'vitest';

const NEW_YORK = 'America/New_York';
const LONDON = 'Europe/London';

// CA, 2026-11-18: an added venue is in the tournament's time zone by default, and the zone is editable. Adding a
// venue by hand never set one, so a zone-less tournament's only source of a zone was a registry address.
describe('defaultVenueTimeZone', () => {
  it("is the tournament's zone", () => {
    expect(defaultVenueTimeZone({ timeZone: NEW_YORK, source: 'tournament' })).toBe(NEW_YORK);
  });

  it('is the zone the other venues agree on when the tournament names none', () => {
    expect(defaultVenueTimeZone({ timeZone: 'Europe/Madrid', source: 'venue' })).toBe('Europe/Madrid');
  });

  it("is never the browser's zone, which the frame only stands in with", () => {
    expect(defaultVenueTimeZone({ timeZone: 'America/Los_Angeles', source: 'browser' })).toBe('');
  });

  it('is empty when the frame is refused', () => {
    expect(defaultVenueTimeZone({ source: 'error', error: { code: 'ERR_CONFLICTING_TIME_ZONES', message: '' } })).toBe(
      '',
    );
  });
});

describe('readVenueTimeZone', () => {
  it('takes a valid zone', () => {
    expect(readVenueTimeZone(' Europe/London ', 'UTC')).toBe(LONDON);
  });

  it('clears on an empty field', () => {
    expect(readVenueTimeZone('', LONDON)).toBe('');
  });

  it('keeps the previous zone when the field holds something that is not a zone', () => {
    expect(readVenueTimeZone('Europe/Lond', LONDON)).toBe(LONDON);
  });
});

describe('buildVenueAddress', () => {
  it('carries the time zone', () => {
    expect(buildVenueAddress({ city: 'Miami', countryCode: 'USA', timeZone: NEW_YORK })).toEqual({
      city: 'Miami',
      countryCode: 'USA',
      timeZone: NEW_YORK,
    });
  });

  it('is an address with only a time zone when that is all the venue has', () => {
    expect(buildVenueAddress({ timeZone: NEW_YORK })).toEqual({ timeZone: NEW_YORK });
  });

  it('is undefined when nothing is filled in', () => {
    expect(buildVenueAddress({ addressLine1: '', city: '', timeZone: '' })).toBeUndefined();
  });
});
