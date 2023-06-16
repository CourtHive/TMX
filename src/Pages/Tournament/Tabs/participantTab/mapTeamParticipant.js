import { getCountry, getEvents } from 'modules/participants/getters';

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
    searchText: participantName.toLowerCase(),
    events: getEvents(participant, derivedEventInfo),
    representing: getCountry(representing),
    individualParticipants,
    participantName,
    participantType,
    participantId,
    membersCount
  };
}
