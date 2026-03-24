import { describe, expect, it } from 'vitest';
import { mapParticipant } from './mapParticipant';

const makeParticipant = (overrides: any = {}) => ({
  participantId: 'p1',
  participantName: 'Smith, John',
  participantType: 'INDIVIDUAL',
  person: {
    standardFamilyName: 'Smith',
    standardGivenName: 'John',
    sex: 'MALE',
    nationalityCode: 'USA',
    tennisId: 'T123',
    addresses: [{ city: 'Austin', state: 'TX' }],
  },
  events: [{ eventId: 'e1' }],
  ratings: {},
  penalties: [],
  signedIn: true,
  teams: [],
  ...overrides,
});

describe('mapParticipant', () => {
  it('maps basic participant fields', () => {
    let result: any = mapParticipant(makeParticipant(), {});
    expect(result.participantId).toBe('p1');
    expect(result.participantName).toBe('Smith, John');
    expect(result.participantType).toBe('INDIVIDUAL');
    expect(result.firstName).toBe('John');
    expect(result.lastName).toBe('Smith');
    expect(result.tennisId).toBe('T123');
    expect(result.signedIn).toBe(true);
  });

  it('builds searchText from name parts', () => {
    let result: any = mapParticipant(makeParticipant(), {});
    expect(result.searchText).toContain('smith');
    expect(result.searchText).toContain('john');
  });

  it('formats sex as PascalCase', () => {
    let result: any = mapParticipant(makeParticipant(), {});
    expect(result.sex).toBe('Male');
  });

  it('builds cityState from address', () => {
    let result: any = mapParticipant(makeParticipant(), {});
    expect(result.cityState).toBe('Austin, TX');
  });

  it('returns undefined cityState when address lacks city or state', () => {
    let result: any = mapParticipant(
      makeParticipant({ person: { ...makeParticipant().person, addresses: [{ city: 'Austin' }] } }),
      {},
    );
    expect(result.cityState).toBeUndefined();
  });

  it('maps eventIds from participant events', () => {
    let result: any = mapParticipant(makeParticipant(), {});
    expect(result.eventIds).toEqual(['e1']);
  });

  it('maps SINGLES ratings with object scaleValue', () => {
    const participant = makeParticipant({
      ratings: { SINGLES: [{ scaleName: 'WTN', scaleValue: { wtnRating: 25.5 } }] },
    });
    let result: any = mapParticipant(participant, {});
    expect(result.ratings.wtn).toEqual({ wtnRating: 25.5 });
  });

  it('wraps primitive scaleValue in accessor object', () => {
    const participant = makeParticipant({
      ratings: { SINGLES: [{ scaleName: 'UTR', scaleValue: 12.5 }] },
    });
    let result: any = mapParticipant(participant, {});
    expect(result.ratings.utr).toEqual({ utrRating: 12.5 });
  });

  it('handles participant with no ratings', () => {
    const participant = makeParticipant({ ratings: {} });
    let result: any = mapParticipant(participant, {});
    expect(result.ratings).toEqual({});
  });
});
