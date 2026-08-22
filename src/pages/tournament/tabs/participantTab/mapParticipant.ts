/**
 * Map participant data with ratings, events, location, and personal information.
 * Creates search text and formats participant details for display.
 * Dynamically collects all ratings present in participant data.
 */
import { getClub, getCountry, getEvents } from 'pages/tournament/tabs/participantTab/getters';
import { factoryConstants, fixtures } from 'tods-competition-factory';
import camelcase from 'camelcase';

// constants
const { ratingsParameters } = fixtures;
const { SINGLES } = factoryConstants.eventConstants;

export const mapParticipant = (participant: any, derivedEventInfo: any): any => {
  const { participantId, participantName, participantType, participantRole, person } = participant;
  const { standardFamilyName, standardGivenName } = person || {};
  const address = participant.person?.addresses?.[0];
  const cityState = address?.city && address?.state ? `${address.city}, ${address.state}` : undefined;

  // Team affiliation + jersey number live on the first entry of
  // `biographicalInformation.teamAttributes[]` — the field the import wizard
  // populates for every imported person regardless of role. Surfaced here so
  // the Competitors view can show a jersey-# column and the Staff view can
  // show a Team-affiliation column.
  const teamAttribute = participant.person?.biographicalInformation?.teamAttributes?.[0];
  const jerseyNumber = teamAttribute?.jerseyNumber;
  const teamAffiliation = teamAttribute?.teamName;

  const ratings: Record<string, any> = {};
  for (const item of participant.ratings?.[SINGLES] || []) {
    const key = item.scaleName.toLowerCase();
    const params = ratingsParameters[item.scaleName.toUpperCase()];
    const accessor = params?.accessor || `${key}Rating`;

    if (typeof item.scaleValue === 'object' && item.scaleValue !== null) {
      ratings[key] = item.scaleValue;
    } else {
      ratings[key] = { [accessor]: item.scaleValue };
    }
  }

  // The primary contact drives two columns: whether the person is reachable at all, and whether that
  // contact carries consent to be published. `isPublic === true` deliberately — absent means not public,
  // and nothing writes the flag on imported records, so a truthy check would read them all as consenting.
  const primaryContact = person?.contacts?.[0];
  const contactPublic = primaryContact?.isPublic === true;
  const hasContact = !!(primaryContact?.mobileTelephone || primaryContact?.telephone || primaryContact?.emailAddress);

  return {
    searchText: [participantName, standardGivenName, standardFamilyName, participant.participantOtherName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
    contactPublic,
    hasContact,
    nickname: participant.participantOtherName,
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
    participantRole,
    teamAffiliation,
    jerseyNumber,
    participantId,
    participant,
    cityState,
    ratings,
  };
};
