import { affiliationIsMembership, getGroupingMembers, getParticipantGroupings } from './participantGroupings';
import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { beforeEach, describe, expect, it } from 'vitest';

// constants
import { ADD_EVENT_ENTRIES, ADD_INDIVIDUAL_PARTICIPANT_IDS, ADD_PARTICIPANTS } from 'constants/mutationConstants';

const pair = (participantId: string, individualParticipantIds: string[]) => ({
  participantRole: 'COMPETITOR',
  participantType: 'PAIR',
  individualParticipantIds,
  participantId,
});

const individual = (participantId: string, standardFamilyName: string) => ({
  person: { standardFamilyName, standardGivenName: participantId },
  participantName: `${participantId} ${standardFamilyName}`,
  participantType: 'INDIVIDUAL',
  participantRole: 'COMPETITOR',
  participantId,
});

// the same participant query the card makes: the participantMap it returns beside `participants` carries every
// participant, hydrated with groupings and event entries
function cardQuery(participantId: string) {
  const result: any = tournamentEngine.getParticipants({
    participantFilters: { participantIds: [participantId] },
    withRankingProfile: true,
    withMatchUps: true,
    withScaleValues: true,
    withEvents: true,
    withISO2: true,
  });
  return { participantMap: result.participantMap, events: tournamentEngine.q.events() };
}

let doublesEventId: string;
let teamEventId: string;
let teamPlayerId: string;
let teamId: string;

beforeEach(() => {
  const result: any = mocksEngine.generateTournamentRecord({
    eventProfiles: [
      { eventType: 'DOUBLES', eventName: 'Doubles', participantsProfile: { participantsCount: 4 } },
      { eventType: 'TEAM', eventName: 'Team Cup', drawProfiles: [{ drawSize: 2 }] },
    ],
    nonRandom: 1,
    setState: true,
  });
  [doublesEventId, teamEventId] = result.eventIds;

  // a new player, in no pair, joins one of the event's teams
  const participants = tournamentEngine.getParticipants().participants as any[];
  teamId = participants.find((p) => p.participantType === 'TEAM').participantId;
  teamPlayerId = 'team-player';
  const queued: any = tournamentEngine.executionQueue([
    { method: ADD_PARTICIPANTS, params: { participants: [individual(teamPlayerId, 'Spruce')] } },
    {
      method: ADD_INDIVIDUAL_PARTICIPANT_IDS,
      params: { groupingParticipantId: teamId, individualParticipantIds: [teamPlayerId] },
    },
  ]);
  expect(queued.success).toEqual(true);
});

describe('getParticipantGroupings', () => {
  it('gives a player in two pairs and one team both pairs, with partners and events, and the team', () => {
    let result: any = tournamentEngine.executionQueue([
      {
        method: ADD_PARTICIPANTS,
        params: { participants: [individual('partner-a', 'Alder'), individual('partner-b', 'Birch')] },
      },
    ]);
    expect(result.success).toEqual(true);

    result = tournamentEngine.executionQueue([
      {
        method: ADD_PARTICIPANTS,
        params: {
          participants: [pair('pair-a', [teamPlayerId, 'partner-a']), pair('pair-b', [teamPlayerId, 'partner-b'])],
        },
      },
    ]);
    expect(result.success).toEqual(true);

    result = tournamentEngine.executionQueue([
      { method: ADD_EVENT_ENTRIES, params: { eventId: doublesEventId, participantIds: ['pair-a'] } },
    ]);
    expect(result.success).toEqual(true);

    const { pairs, teams, groups } = getParticipantGroupings({
      participantId: teamPlayerId,
      ...cardQuery(teamPlayerId),
    });

    expect(pairs.map(({ participantId }) => participantId).sort((a, b) => a.localeCompare(b))).toEqual([
      'pair-a',
      'pair-b',
    ]);
    const pairA = pairs.find(({ participantId }) => participantId === 'pair-a');
    const pairB = pairs.find(({ participantId }) => participantId === 'pair-b');
    expect(pairA?.partners).toEqual([{ participantId: 'partner-a', participantName: 'partner-a Alder' }]);
    expect(pairB?.partners).toEqual([{ participantId: 'partner-b', participantName: 'partner-b Birch' }]);
    expect(pairA?.events.map(({ eventId, eventName }) => ({ eventId, eventName }))).toEqual([
      { eventId: doublesEventId, eventName: 'Doubles' },
    ]);
    expect(pairA?.entered).toEqual(true);
    expect(pairB?.events).toEqual([]);
    expect(pairB?.entered).toEqual(false);

    expect(teams.map(({ participantId }) => participantId)).toEqual([teamId]);
    expect(teams[0].events.map(({ eventId, eventName }) => ({ eventId, eventName }))).toEqual([
      { eventId: teamEventId, eventName: 'Team Cup' },
    ]);
    expect(teams[0].entered).toEqual(true);
    expect(groups).toEqual([]);

    // the pair's own card lists both of its players
    const members = getGroupingMembers({ participantId: 'pair-a', ...cardQuery('pair-a') });
    expect(members.map(({ participantId }) => participantId)).toEqual([teamPlayerId, 'partner-a']);
  });

  it('gives a player in no pair, team or group nothing', () => {
    const result: any = tournamentEngine.executionQueue([
      { method: ADD_PARTICIPANTS, params: { participants: [individual('loner', 'Cedar')] } },
    ]);
    expect(result.success).toEqual(true);

    const groupings = getParticipantGroupings({ participantId: 'loner', ...cardQuery('loner') });
    expect(groupings).toEqual({ pairs: [], teams: [], groups: [] });
    expect(getGroupingMembers({ participantId: 'loner', ...cardQuery('loner') })).toEqual([]);
  });

  it('gives nothing for a participant the map does not hold', () => {
    expect(getParticipantGroupings({ participantId: 'missing', ...cardQuery('missing') })).toEqual({
      pairs: [],
      teams: [],
      groups: [],
    });
  });
});

describe('affiliationIsMembership', () => {
  const teams = [{ participantId: 't1', participantName: 'Altitude', events: [], entered: true }];

  it('is true only when the affiliation names a team the participant is a member of', () => {
    expect(affiliationIsMembership(' altitude ', teams)).toEqual(true);
    expect(affiliationIsMembership('Fortune', teams)).toEqual(false);
    expect(affiliationIsMembership(undefined, teams)).toEqual(false);
    expect(affiliationIsMembership('Altitude', [])).toEqual(false);
  });
});
