import { getCountry, getEvents } from 'pages/tournament/tabs/participantTab/getters';

export function mapTeamParticipant(participant: any, derivedEventInfo: any): any {
  const {
    individualParticipantIds,
    individualParticipants,
    participantName,
    participantType,
    participantRole,
    participantId,
    representing,
  } = participant;

  const membersCount = individualParticipantIds?.length || 0;

  return {
    events: getEvents(participant, derivedEventInfo),
    eventIds: participant.events.map(({ eventId }: any) => eventId),
    searchText: participantName.toLowerCase(),
    representing: getCountry(representing),
    individualParticipants,
    participantName,
    participantType,
    // The groupings table's role column reads `field: 'participantRole'`. Without it here the cell
    // resolves to undefined and the badge silently never renders, whatever the record actually says.
    participantRole,
    participantId,
    membersCount,
  };
}
