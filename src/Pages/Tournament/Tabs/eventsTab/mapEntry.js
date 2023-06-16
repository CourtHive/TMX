import { drawDefinitionConstants, entryStatusConstants, eventConstants } from 'tods-competition-factory';
const { ALTERNATE, WILDCARD, DIRECT_ACCEPTANCE } = entryStatusConstants;
const { QUALIFYING } = drawDefinitionConstants;
const { TEAM } = eventConstants;

const statusMapping = {
  [DIRECT_ACCEPTANCE]: 'DA',
  [QUALIFYING]: 'QUAL',
  [ALTERNATE]: 'ALT',
  [WILDCARD]: 'WC'
};

export function mapEntry({ entry, participants, participant, eventType }) {
  participant = participant || participants.find((p) => p.participantId === entry.participantId);
  const address = participant?.person?.addresses?.[0];
  const cityState = address ? `${address.city}, ${address.state}` : undefined;
  const ratingType = eventType === TEAM ? 'AVERAGE' : eventType;
  const wtn = participant?.ratings?.[ratingType]?.find((rating) => rating.scaleName === 'WTN')?.scaleValue;
  const ratings = { wtn };

  const status = statusMapping[entry.entryStatus];

  return {
    searchText: participant?.participantName.toLowerCase(),
    participant,
    cityState,
    ...entry,
    ratings,
    status
  };
}
