import { globalState, mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { anonymizedCopy } from './anonymizedCopy';
import { describe, expect, it } from 'vitest';

/**
 * The anonymized export runs the factory's in-place anonymizer on a deep copy. The record the engine holds
 * must come out byte-identical: the live reference is passed in, so a missing clone would rewrite it.
 */
describe('anonymizedCopy', () => {
  function seed() {
    const { tournamentRecord } = mocksEngine.generateTournamentRecord({
      participantsProfile: { participantsCount: 16, participantType: 'PAIR' },
      drawProfiles: [{ drawSize: 8, eventType: 'DOUBLES' }],
      venueProfiles: [{ courtsCount: 2 }],
      completeAllMatchUps: true,
      setState: true,
    });
    const tournamentId = tournamentRecord.tournamentId;

    // Identifying fields the factory's anonymizer does not touch, added to the LIVE record.
    const live = globalState.getTournamentRecord(tournamentId);
    live.linkedTournamentIds = ['other-tournament-id'];
    live.onlineResources = [{ identifier: 'https://example.org/t', resourceType: 'URL' }];
    live.notes = 'director phone 555-0100';
    live.formalName = 'The Real Tournament Name';
    live.parentOrganisationId = 'real-provider-id';
    live.tournamentOtherIds = [{ tournamentId: 'external-id', organisationId: 'org' }];
    const individual = live.participants.find((p: any) => p.participantType === 'INDIVIDUAL');
    individual.personId = individual.person.personId;
    individual.contacts = [{ emailAddress: 'player@example.org' }];
    individual.participantOtherIds = [{ participantId: 'external-participant-id' }];
    individual.notes = 'allergic to peanuts';
    live.venues[0].contacts = [{ telephone: '555-0101' }];
    live.venues[0].courts[0].latitude = '51.4';
    live.venues[0].courts[0].longitude = '-0.2';

    return { tournamentId, live, individualId: individual.participantId };
  }

  it('anonymizes persons on the copy and leaves the live engine record untouched', () => {
    const { tournamentId, live } = seed();
    const snapshot = structuredClone(live);

    let result: any = anonymizedCopy(live);
    expect(result.error).toBeUndefined();
    const copy = result.tournamentRecord;

    expect(globalState.getTournamentRecord(tournamentId)).toBe(live);
    expect(live).toEqual(snapshot);
    expect(tournamentEngine.getTournament().tournamentRecord).toEqual(snapshot);

    expect(copy.tournamentId).not.toEqual(tournamentId);
    expect(copy.isMock).toBe(true);

    const persons = (record: any) =>
      record.participants.filter((p: any) => p.participantType === 'INDIVIDUAL').map((p: any) => p.person);
    const originalPersons = persons(snapshot);
    const copiedPersons = persons(copy);
    expect(copiedPersons).toHaveLength(originalPersons.length);
    const originalPersonIds = new Set(originalPersons.map((p: any) => p.personId));
    const originalNames = new Set(originalPersons.map((p: any) => `${p.standardGivenName} ${p.standardFamilyName}`));
    for (const person of copiedPersons) {
      expect(originalPersonIds.has(person.personId)).toBe(false);
    }
    const unchangedNames = copiedPersons.filter((p: any) =>
      originalNames.has(`${p.standardGivenName} ${p.standardFamilyName}`),
    );
    expect(unchangedNames.length).toBeLessThan(copiedPersons.length);

    const originalParticipantIds = new Set(snapshot.participants.map((p: any) => p.participantId));
    for (const participant of copy.participants) {
      expect(originalParticipantIds.has(participant.participantId)).toBe(false);
    }
  });

  it('clears the identifying fields the factory anonymizer leaves in place', () => {
    const { live, individualId } = seed();
    const snapshot = structuredClone(live);

    let result: any = anonymizedCopy(live);
    const copy = result.tournamentRecord;
    expect(live).toEqual(snapshot);

    for (const field of [
      'linkedTournamentIds',
      'onlineResources',
      'notes',
      'formalName',
      'parentOrganisationId',
      'tournamentOtherIds',
    ]) {
      expect(copy[field]).toBeUndefined();
    }
    expect(copy.parentOrganisation).toBeUndefined();

    const position = snapshot.participants.findIndex((p: any) => p.participantId === individualId);
    const participant = copy.participants[position];
    expect(participant.contacts).toBeUndefined();
    expect(participant.participantOtherIds).toBeUndefined();
    expect(participant.notes).toBeUndefined();
    expect(participant.personId).toEqual(participant.person.personId);
    expect(participant.person.personId).not.toEqual(snapshot.participants[position].person.personId);

    expect(copy.venues[0].contacts).toBeUndefined();
    expect(copy.venues[0].addresses).toEqual([]);
    expect(copy.venues[0].courts[0].latitude).toBeUndefined();
    expect(copy.venues[0].courts[0].longitude).toBeUndefined();
  });

  it('refuses a missing record', () => {
    let result: any = anonymizedCopy(undefined);
    expect(result.error).toBeDefined();
    expect(result.tournamentRecord).toBeUndefined();
  });
});
