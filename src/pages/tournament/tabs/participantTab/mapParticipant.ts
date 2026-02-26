/**
 * Map participant data with ratings, events, location, and personal information.
 * Creates search text and formats participant details for display.
 * Dynamically collects all ratings present in participant data.
 */
import { getClub, getCountry, getEvents } from 'pages/tournament/tabs/participantTab/getters';
import { factoryConstants } from 'tods-competition-factory';
import camelcase from 'camelcase';

// constants
const { SINGLES } = factoryConstants.eventConstants;

export const mapParticipant = (participant: any, derivedEventInfo: any): any => {
  const { participantId, participantName, participantType, person } = participant;
  const { standardFamilyName, standardGivenName } = person || {};
  const address = participant.person?.addresses?.[0];
  const cityState = address?.city && address?.state ? `${address.city}, ${address.state}` : undefined;

  const ratings: Record<string, any> = {};
  for (const item of participant.ratings?.[SINGLES] || []) {
    ratings[item.scaleName.toLowerCase()] = item.scaleValue;
  }

  return {
    searchText: `${participantName} ${standardGivenName} ${standardFamilyName}`.toLowerCase(),
    sex: camelcase(participant.person.sex || '', { pascalCase: true }),
    eventIds: participant.events.map(({ eventId }: any) => eventId),
    ioc: getCountry(participant.person?.nationalityCode),
    events: getEvents(participant, derivedEventInfo),
    penalties: participant.penalties || [],
    tennisId: participant.person.tennisId,
    signedIn: participant.signedIn,
    lastName: standardFamilyName,
    firstName: standardGivenName,
    club: getClub(participant),
    teams: participant.teams,
    participantName,
    participantType,
    participantId,
    participant,
    cityState,
    ratings,
  };
};
