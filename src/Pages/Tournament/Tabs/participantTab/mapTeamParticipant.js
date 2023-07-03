import { getCountry, getEvents } from 'Pages/Tournament/Tabs/participantTab/getters';

export function mapTeamParticipant(participant, derivedEventInfo) {
  const {
    individualParticipantIds,
    individualParticipants,
    participantName,
    participantType,
    participantId,
    representing
  } = participant;

  const membersCount = individualParticipantIds?.length || 0;

  return {
    events: getEvents(participant, derivedEventInfo),
    eventIds: participant.events.map(({ eventId }) => eventId),
    searchText: participantName.toLowerCase(),
    representing: getCountry(representing),
    individualParticipants,
    participantName,
    participantType,
    participantId,
    membersCount
  };
}
