import { fixtures } from 'tods-competition-factory';

const getGroup = (participant, role) => {
  return participant.groups?.find((group) => group.participantRoleResponsibilities.includes(role))?.participantName;
};
export const getClub = (participant) => getGroup(participant, 'CLUB');
export const getSchool = (participant) => getGroup(participant, 'SCHOOL');

export const getCity = (participant) => {
  return participant.person?.addresses?.find(({ city }) => city)?.[0].city;
};
export const getEvents = (participant, derivedEventInfo) => {
  return (participant.events || []).map(({ eventId }) => derivedEventInfo?.[eventId]);
};

export const getCountry = (nationalityCode) =>
  fixtures.countries.find((country) => country.ioc === nationalityCode || country.iso === nationalityCode)?.label || '';
