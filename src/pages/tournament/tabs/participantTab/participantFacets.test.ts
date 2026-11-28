import { defined } from 'functions/testing/defined';
import type { Participant } from 'tods-competition-factory';
import { eventGovernor, mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';
import {
  NO_AGE_CATEGORY,
  ageBuckets,
  ageMembership,
  createAgeIndex,
  expandAgeRules,
  hasDob,
  hasRating,
  isEntered,
  isSignedIn,
} from './participantFacets';

const FIRST_DAY = '2026-06-01';
const U14_DOB = '2013-05-05';

const row = (overrides: any = {}) => ({
  participantId: overrides.participantId ?? 'p1',
  eventIds: overrides.eventIds ?? [],
  signedIn: overrides.signedIn,
  ratings: overrides.ratings ?? {},
  participant: { participantId: overrides.participantId ?? 'p1', person: overrides.person ?? {} },
});

describe('row predicates', () => {
  it('reads sign-in, entry and rating from the mapped row', () => {
    expect(isSignedIn(row({ signedIn: true }))).toBe(true);
    expect(isSignedIn(row())).toBe(false);
    expect(isEntered(row({ eventIds: ['e1'] }))).toBe(true);
    expect(isEntered(row())).toBe(false);
    expect(hasRating(row({ ratings: { wtn: { wtnRating: 20 } } }))).toBe(true);
    expect(hasRating(row())).toBe(false);
  });

  it('counts a birth year as a DOB, as the factory does (calendar-year age)', () => {
    expect(hasDob(row({ person: { birthDate: '2012-03-04' } }))).toBe(true);
    expect(hasDob(row({ person: { birthYear: 2012 } }))).toBe(true);
    expect(hasDob(row({ person: {} }))).toBe(false);
  });
});

describe('ageBuckets', () => {
  it('takes one bucket per distinct age category, youngest first, carrying only the age rule', () => {
    const events = [
      { eventId: 'b', category: { ageCategoryCode: 'U16', ratingType: 'WTN', ratingMax: 30 }, startDate: FIRST_DAY },
      { eventId: 'a', category: { ageCategoryCode: 'U12' } },
      { eventId: 'c', category: { ageCategoryCode: 'U16' } },
      { eventId: 'open', category: { categoryName: 'Open' } },
    ];
    const { buckets, byCategory } = ageBuckets(events, { startDate: FIRST_DAY });
    expect(byCategory).toBe(true);
    expect(buckets.map(({ label }) => label)).toEqual(['U12', 'U16']);
    // the rating rule stays out: a bucket asks about age alone
    expect(buckets[1].event.category).toEqual({ ageCategoryCode: 'U16' });
    expect(buckets[1].event.startDate).toBe(FIRST_DAY);
  });

  it('falls back to decades on the first day when no event has an age rule', () => {
    const { buckets, byCategory } = ageBuckets([{ eventId: 'open' }], { startDate: FIRST_DAY });
    expect(byCategory).toBe(false);
    expect(buckets.map(({ label }) => label)).toEqual(['<10', '10–19', '20–29', '30–39', '40–49', '50–59', '60+']);
    expect(buckets[2].event).toMatchObject({
      startDate: FIRST_DAY,
      endDate: FIRST_DAY,
      category: { ageMin: 20, ageMax: 29 },
    });
  });
});

describe('ageMembership', () => {
  const buckets = ageBuckets([{ eventId: 'u14', category: { ageCategoryCode: 'U14' } }]).buckets;

  it('leaves out a participant with no DOB, and files one who fits no category under NO_AGE_CATEGORY', () => {
    const rows = [
      row({ participantId: 'kid', person: { birthYear: 2015 } }),
      row({ participantId: 'adult', person: { birthYear: 1990 } }),
      row({ participantId: 'unknown', person: {} }),
    ];
    const eligibility = (participant: any) => ({ eligible: participant.participantId === 'kid' });
    const membership = ageMembership(rows, buckets, eligibility, { categories: true });
    expect([...(membership.get('kid') ?? [])]).toEqual(['age:U14']);
    expect([...(membership.get('adult') ?? [])]).toEqual([NO_AGE_CATEGORY]);
    expect(membership.has('unknown')).toBe(false);
  });

  it('agrees with the factory: a U14 bucket holds exactly who the U14 event accepts on age', () => {
    const startDate = '2026-06-10';
    const endDate = '2026-06-14';
    const { tournamentRecord } = mocksEngine.generateTournamentRecord({
      tournamentAttributes: { startDate, endDate },
      participantsProfile: { participantsCount: 0 },
      eventProfiles: [{ eventName: 'U14', category: { ageCategoryCode: 'U14' } }],
    });
    const person = (id: string, birthDate?: string): Participant => ({
      participantId: id,
      participantType: 'INDIVIDUAL',
      participantRole: 'COMPETITOR',
      person: {
        personId: `person-${id}`,
        standardFamilyName: id,
        standardGivenName: id,
        ...(birthDate && { birthDate }),
      },
    });
    // 13 throughout; turns 14 mid-event (U14 means under 14 for the whole event); 15; no DOB
    tournamentRecord.participants = [
      person('thirteen', '2013-01-01'),
      person('birthday', '2012-06-12'),
      person('fifteen', '2011-01-01'),
      person('nodob'),
    ];
    tournamentEngine.setState(tournamentRecord);
    const event = defined(tournamentRecord.events)[0];
    const { buckets } = ageBuckets(defined(tournamentRecord.events), tournamentRecord);
    const rows = defined(tournamentRecord.participants).map((participant: any) => ({
      participantId: participant.participantId,
      participant,
    }));

    const membership = ageMembership(
      rows,
      buckets,
      (participant, bucketEvent) =>
        eventGovernor.getParticipantEligibility({ participant, event: bucketEvent, tournamentRecord }),
      { categories: true },
    );
    for (const { participant } of rows) {
      if (participant.participantId === 'nodob') continue;
      const accepted = tournamentEngine.getParticipantEligibility({ participant, event }).eligible;
      expect(membership.get(participant.participantId)?.has('age:U14'), participant.participantId).toBe(accepted);
    }
    expect(membership.get('thirteen')?.has('age:U14')).toBe(true);
    // 13 on the first day, 14 on the last: U14 must hold for the whole event, so the factory says no, and so does the bucket
    expect(membership.get('birthday')?.has('age:U14')).toBe(false);
    expect(membership.get('fifteen')?.has('age:U14')).toBe(false);
    expect(membership.has('nodob')).toBe(false);
  });
});

describe('expandAgeRules', () => {
  it('gives the same verdict as the code the factory would expand itself, for every DOB around each boundary', () => {
    const startDate = '2026-06-10';
    const endDate = '2026-06-14';
    const tournamentRecord: any = { tournamentId: 't', startDate, endDate, participants: [], events: [] };
    const codes = ['U10', 'U12', 'U14', 'U16', 'U18', '18O', 'O35', '10-12', 'C50-70'];
    const events = codes.map((code) => ({ eventId: code, category: { ageCategoryCode: code }, startDate, endDate }));
    const { buckets } = ageBuckets(events, tournamentRecord);
    const expanded = expandAgeRules(buckets, tournamentRecord, (args) => eventGovernor.getCategoryAgeDetails(args));
    // the expansion did something: a bare code now carries its range
    expect(expanded.find(({ label }) => label === 'U14')?.event.category).toMatchObject({
      ageCategoryCode: 'U14',
      ageMax: 13,
    });

    // every day of the year around the start and end dates, for ages 5 to 40, plus birth-year-only DOBs
    const dobs: any[] = [];
    for (let age = 5; age <= 40; age++) {
      for (const day of [
        '06-08',
        '06-09',
        '06-10',
        '06-11',
        '06-12',
        '06-13',
        '06-14',
        '06-15',
        '06-16',
        '01-01',
        '12-31',
      ]) {
        dobs.push({ birthDate: `${2026 - age}-${day}` });
      }
      dobs.push({ birthYear: 2026 - age });
    }
    const verdict = (bucket: any, person: any) =>
      eventGovernor.getParticipantEligibility({
        participant: { participantId: 'p', participantType: 'INDIVIDUAL', person: { personId: 'x', ...person } },
        event: bucket.event,
        tournamentRecord,
      }).eligible;
    let compared = 0;
    buckets.forEach((bucket, i) => {
      for (const person of dobs) {
        expect(verdict(expanded[i], person), `${bucket.label} ${JSON.stringify(person)}`).toBe(verdict(bucket, person));
        compared += 1;
      }
    });
    expect(compared).toBe(codes.length * dobs.length);
  });
});

describe('createAgeIndex', () => {
  const buckets = ageBuckets([
    { eventId: 'u14', category: { ageCategoryCode: 'U14' } },
    { eventId: 'u16', category: { ageCategoryCode: 'U16' } },
  ]).buckets;

  it('asks the factory once per distinct DOB, not once per participant', () => {
    const index = createAgeIndex(buckets, () => ({ eligible: true }), { categories: true });
    const rows = Array.from({ length: 30 }, (_, i) =>
      row({ participantId: `p${i}`, person: { birthDate: i % 2 ? U14_DOB : '2012-01-01' } }),
    );
    for (const rowData of rows) index.of(rowData);
    for (const rowData of rows) index.of(rowData); // a repaint
    expect(index.calls()).toBe(2 * buckets.length);
  });

  it('answers a participant added after it was built, and a changed DOB by the new DOB', () => {
    const eligibility = (participant: any) => ({ eligible: participant.person.birthDate === U14_DOB });
    const index = createAgeIndex(buckets, eligibility, { categories: true });
    expect([...(index.of(row({ person: { birthDate: '1990-01-01' } })) ?? [])]).toEqual([NO_AGE_CATEGORY]);
    // a new row object, as replaceData brings after an add or an edit
    expect([...(index.of(row({ participantId: 'late', person: { birthDate: U14_DOB } })) ?? [])]).toEqual([
      'age:U14',
      'age:U16',
    ]);
  });
});
