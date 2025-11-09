import { fixtures } from 'tods-competition-factory';

const getGroup = (participant: any, role: string): string | undefined => {
  return participant.groups?.find((group: any) => group.participantRoleResponsibilities?.includes(role))?.participantName;
};
export const getClub = (participant: any): string | undefined => getGroup(participant, 'CLUB');
export const getSchool = (participant: any): string | undefined => getGroup(participant, 'SCHOOL');

export const getCity = (participant: any): string | undefined => {
  return participant.person?.addresses?.find(({ city }: any) => city)?.[0].city;
};
export const getEvents = (participant: any, derivedEventInfo: any): any[] => {
  return (participant.events || []).map(({ eventId }: any) => derivedEventInfo?.[eventId]);
};

export const getCountry = (nationalityCode: string): string =>
  fixtures.countries.find((country: any) => country.ioc === nationalityCode || country.iso === nationalityCode)?.label || '';
