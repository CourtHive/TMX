/**
 * Map participant data with ratings, events, location, and personal information.
 * Creates search text and formats participant details for display.
 * Dynamically collects all ratings present in participant data.
 */
import { getClub, getCountry, getEvents } from 'pages/tournament/tabs/participantTab/getters';
import { isPublicContact, reachableContacts } from 'services/contact/contactLinks';
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

  // Contacts drive three columns: the tappable affordances, whether the person is reachable at all,
  // and whether anything about them carries consent to be published.
  //
  // Both summaries read the WHOLE list rather than `contacts[0]`. The factory publishes every contact
  // marked `isPublic` — not just the primary — so "the primary consented" was a less accurate answer
  // to "what will appear publicly" than "some contact consented", and it under-reported reachability
  // for an imported record whose first entry is a name with no number.
  //
  // `isPublic === true` deliberately: absent means not public. Nothing wrote the flag before factory
  // #4680, so a truthy check would read every imported contact as consenting.
  const contacts = reachableContacts(person?.contacts);
  const contactPublic = contacts.some(isPublicContact);
  const hasContact = contacts.length > 0;

  return {
    contacts,
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
