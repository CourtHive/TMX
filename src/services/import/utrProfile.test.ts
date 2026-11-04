import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { applyUtrProfile, utrProfileItems, UTR_PROFILE_RESOURCE_NAME as NAME } from './utrProfile';
import { describe, expect, it } from 'vitest';

// constants
import { ADD_PARTICIPANTS, MODIFY_PARTICIPANT } from 'constants/mutationConstants';

const ORGANISATION = 'UTR';
const SUBTYPE = 'PROFILE';
const PROFILE_URL = 'https://app.example.org/profiles/123456';

// the attributes of a CODES OnlineResource (tournament.schema.json, definitions.OnlineResource)
const CODES_ONLINE_RESOURCE_KEYS = [
  'createdAt',
  'extensions',
  'notes',
  'timeItems',
  'updatedAt',
  'isMock',
  'identifier',
  'name',
  'provider',
  'resourceSubType',
  'resourceType',
];

function draft(utrProfile: string) {
  const participant: any = {
    participantId: `p-${utrProfile.length}`,
    participantType: 'INDIVIDUAL',
    participantRole: 'COMPETITOR',
    person: { standardGivenName: 'Ada', standardFamilyName: 'Lovelace' },
  };
  applyUtrProfile(participant, utrProfile);
  return participant;
}

function stored(participantId: string) {
  return tournamentEngine
    .getTournament()
    .tournamentRecord.participants.find((p: any) => p.participantId === participantId);
}

describe('utrProfileItems', () => {
  it('a profile URL gives a CODES OnlineResource typed by resourceType, and a personOtherId', () => {
    const { otherId, onlineResource } = utrProfileItems(PROFILE_URL);
    expect(otherId).toEqual({ uniqueOrganisationName: ORGANISATION, personId: '123456' });
    expect(onlineResource).toEqual({
      resourceType: 'URL',
      resourceSubType: SUBTYPE,
      name: NAME,
      identifier: PROFILE_URL,
    });
    expect(onlineResource).not.toHaveProperty('resource');
    expect(Object.keys(onlineResource ?? {}).every((key) => CODES_ONLINE_RESOURCE_KEYS.includes(key))).toEqual(true);
  });

  it('a bare id gives only the personOtherId', () => {
    expect(utrProfileItems('123456')).toEqual({
      otherId: { uniqueOrganisationName: ORGANISATION, personId: '123456' },
    });
  });

  it('a URL with no id after profiles/ gives nothing', () => {
    expect(utrProfileItems('https://app.example.org/profiles/')).toEqual({});
  });
});

describe('applyUtrProfile, through the engine', () => {
  it('an imported participant stores the resource with resourceType, and re-imports it unchanged', () => {
    mocksEngine.generateTournamentRecord({ setState: true });
    const participant = draft(PROFILE_URL);

    let result: any = tournamentEngine.executionQueue([
      { method: ADD_PARTICIPANTS, params: { participants: [participant] } },
    ]);
    expect(result.success).toEqual(true);
    const resources = stored(participant.participantId).onlineResources;
    expect(resources).toEqual([{ resourceType: 'URL', resourceSubType: SUBTYPE, name: NAME, identifier: PROFILE_URL }]);
    expect(stored(participant.participantId).person.personOtherIds).toEqual([
      { uniqueOrganisationName: ORGANISATION, personId: '123456' },
    ]);

    // a re-import with "update existing" sends the participant back through modifyParticipant
    result = tournamentEngine.executionQueue([
      { method: MODIFY_PARTICIPANT, params: { participant: draft(PROFILE_URL) } },
    ]);
    expect(result.success).toEqual(true);
    expect(stored(participant.participantId).onlineResources).toEqual(resources);
  });

  it('a re-import replaces a resource stored under the old `resource` key with a resourceType one', () => {
    mocksEngine.generateTournamentRecord({ setState: true });
    const participant = draft(PROFILE_URL);
    const legacy = { resourceSubType: SUBTYPE, identifier: PROFILE_URL, name: NAME, resource: 'URL' };
    let result: any = tournamentEngine.addParticipants({
      participants: [{ ...participant, onlineResources: [legacy] }],
    });
    expect(result.success).toEqual(true);
    expect(stored(participant.participantId).onlineResources).toEqual([legacy]);

    result = tournamentEngine.executionQueue([{ method: MODIFY_PARTICIPANT, params: { participant } }]);
    expect(result.success).toEqual(true);
    const [resource] = stored(participant.participantId).onlineResources;
    expect(resource.resourceType).toEqual('URL');
    expect(resource).not.toHaveProperty('resource');
  });

  it('a bare id adds no onlineResources, so a re-import does not clear the stored ones', () => {
    mocksEngine.generateTournamentRecord({ setState: true });
    const withUrl = draft(PROFILE_URL);
    let result: any = tournamentEngine.addParticipants({ participants: [withUrl] });
    expect(result.success).toEqual(true);

    const bareId = { ...draft('123456'), participantId: withUrl.participantId };
    expect(bareId).not.toHaveProperty('onlineResources');
    result = tournamentEngine.executionQueue([{ method: MODIFY_PARTICIPANT, params: { participant: bareId } }]);
    expect(result.success).toEqual(true);
    expect(stored(withUrl.participantId).onlineResources).toEqual(withUrl.onlineResources);
  });
});
