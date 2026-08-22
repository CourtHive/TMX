import { mapParticipant } from './mapParticipant';
import { describe, expect, it } from 'vitest';

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

  /**
   * The public-contact indicator distinguishes THREE states, and the third is the reason it is not a
   * plain tick/cross: consented, has a contact but has not consented, and has no contact at all.
   * Collapsing the last two would make "nobody has opted in" look identical to "nobody has a phone
   * number" — different problems for a director.
   */
  const MOBILE = '+1 555 0100';

  describe('contact indicator fields', () => {
    const withContacts = (contacts: any) => {
      const participant = makeParticipant({});
      participant.person = { ...participant.person, contacts };
      return mapParticipant(participant, {});
    };

    it('reports a consenting contact', () => {
      const result: any = withContacts([{ mobileTelephone: MOBILE, isPublic: true }]);
      expect(result.hasContact).toEqual(true);
      expect(result.contactPublic).toEqual(true);
    });

    it('reports a contact that has NOT consented', () => {
      const result: any = withContacts([{ mobileTelephone: MOBILE, isPublic: false }]);
      expect(result.hasContact).toEqual(true);
      expect(result.contactPublic).toEqual(false);
    });

    it('treats an absent isPublic as not consenting', () => {
      // Nothing writes the flag on imported records, so a truthy check would read every imported
      // contact as consenting to publication.
      const result: any = withContacts([{ mobileTelephone: MOBILE }]);
      expect(result.hasContact).toEqual(true);
      expect(result.contactPublic).toEqual(false);
    });

    it('reports no contact when the entry carries no reachable detail', () => {
      // A contact with only a `name` is not something a director can ring.
      const result: any = withContacts([{ name: 'desk' }]);
      expect(result.hasContact).toEqual(false);
    });

    it('reports no contact when there are none at all', () => {
      expect((withContacts(undefined) as any).hasContact).toEqual(false);
      expect((withContacts([]) as any).hasContact).toEqual(false);
    });

    it('counts email alone as reachable', () => {
      expect((withContacts([{ emailAddress: 'a@example.org' }]) as any).hasContact).toEqual(true);
    });
  });
});
