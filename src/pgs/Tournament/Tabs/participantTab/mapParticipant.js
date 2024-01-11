import { getClub, getCountry, getEvents } from 'pgs/Tournament/Tabs/participantTab/getters';
import { factoryConstants } from 'tods-competition-factory';
import camelcase from 'camelcase';

const { WTN, UTR } = factoryConstants.ratingConstants;
const { SINGLES } = factoryConstants.eventConstants;

export const mapParticipant = (participant, derivedEventInfo) => {
  const { participantId, participantName, participantType, person } = participant;
  const { standardFamilyName, standardGivenName } = person || {};
  const address = participant.person?.addresses?.[0];
  const cityState = address?.city && address?.state ? `${address.city}, ${address.state}` : undefined;

  const utr = participant.ratings?.[SINGLES]?.find((rating) => rating.scaleName === UTR)?.scaleValue;
  const wtn = participant.ratings?.[SINGLES]?.find((rating) => rating.scaleName === WTN)?.scaleValue;
  const ratings = { wtn, utr };

  return {
    searchText: `${participantName} ${standardGivenName} ${standardFamilyName}`.toLowerCase(),
    sex: camelcase(participant.person.sex || '', { pascalCase: true }),
    eventIds: participant.events.map(({ eventId }) => eventId),
    ioc: getCountry(participant.person?.nationalityCode),
    events: getEvents(participant, derivedEventInfo),
    penalties: participant.penalties || [],
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
