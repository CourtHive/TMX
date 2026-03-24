import { describe, expect, it } from 'vitest';
import { getClub, getSchool, getCity, getEvents, getCountry } from './getters';

describe('getClub', () => {
  it('returns club name from participant groups', () => {
    const participant = {
      groups: [{ participantName: 'Tennis Club A', participantRoleResponsibilities: ['CLUB'] }],
    };
    expect(getClub(participant)).toBe('Tennis Club A');
  });

  it('returns undefined when no CLUB role', () => {
    const participant = {
      groups: [{ participantName: 'School B', participantRoleResponsibilities: ['SCHOOL'] }],
    };
    expect(getClub(participant)).toBeUndefined();
  });

  it('returns undefined when no groups', () => {
    expect(getClub({})).toBeUndefined();
  });
});

describe('getSchool', () => {
  it('returns school name from participant groups', () => {
    const participant = {
      groups: [{ participantName: 'State University', participantRoleResponsibilities: ['SCHOOL'] }],
    };
    expect(getSchool(participant)).toBe('State University');
  });

  it('returns undefined when no SCHOOL role', () => {
    expect(getSchool({ groups: [] })).toBeUndefined();
  });
});

describe('getCity', () => {
  it('returns city from first address with a city', () => {
    const participant = {
      person: { addresses: [{ city: 'Austin', state: 'TX' }] },
    };
    expect(getCity(participant)).toBe('Austin');
  });

  it('skips addresses without a city', () => {
    const participant = {
      person: { addresses: [{ state: 'TX' }, { city: 'Dallas', state: 'TX' }] },
    };
    expect(getCity(participant)).toBe('Dallas');
  });

  it('returns undefined when no addresses', () => {
    expect(getCity({ person: {} })).toBeUndefined();
  });

  it('returns undefined when participant has no person', () => {
    expect(getCity({})).toBeUndefined();
  });
});

describe('getEvents', () => {
  it('maps participant event IDs to event details', () => {
    const participant = { events: [{ eventId: 'e1' }, { eventId: 'e2' }] };
    const derivedEventInfo = {
      e1: { eventName: 'Singles', drawSize: 32 },
      e2: { eventName: 'Doubles', drawSize: 16 },
    };
    const result = getEvents(participant, derivedEventInfo);
    expect(result).toHaveLength(2);
    expect(result[0].eventName).toBe('Singles');
    expect(result[1].eventName).toBe('Doubles');
  });

  it('returns empty array when no events', () => {
    expect(getEvents({}, {})).toEqual([]);
  });

  it('returns undefined entries for missing event info', () => {
    const participant = { events: [{ eventId: 'e1' }] };
    const result = getEvents(participant, {});
    expect(result[0]).toBeUndefined();
  });
});

describe('getCountry', () => {
  it('returns country label for known IOC code', () => {
    expect(getCountry('USA')).toBe('United States');
  });

  it('returns empty string for unknown code', () => {
    expect(getCountry('ZZZ')).toBe('');
  });

  it('matches ISO codes', () => {
    // GBR is IOC for Great Britain
    const result = getCountry('GBR');
    expect(result).toBeTruthy();
  });
});
