import { drawDefinitionConstants, factoryConstants } from 'tods-competition-factory';
import { entryStatusMapping } from 'constants/tmxConstants';

const { WTN, UTR } = factoryConstants.ratingConstants;
const { TEAM } = factoryConstants.eventConstants;
const { QUALIFYING } = drawDefinitionConstants;

export function mapEntry({ entry, derivedDrawInfo, participants, participant, eventType, eventId }) {
  participant = participant || participants?.find((p) => p.participantId === entry.participantId);
  const flights =
    participant?.draws
      ?.filter((flight) => flight.eventId === eventId)
      .map((flight) => ({ ...flight, drawName: derivedDrawInfo[flight.drawId].drawName })) ?? [];
  const address = participant?.person?.addresses?.[0];
  const cityState = address ? `${address.city}, ${address.state}` : undefined;

  const ratingType = eventType === TEAM ? 'AVERAGE' : eventType; // TODO: AVERAGE is to be team average
  const wtn = participant?.ratings?.[ratingType]?.find((rating) => rating.scaleName === WTN)?.scaleValue;
  const utr = participant?.ratings?.[ratingType]?.find((rating) => rating.scaleName === UTR)?.scaleValue;
  const ratings = { wtn, utr };

  const scaleName = entry.entryStage === QUALIFYING ? `${eventId}${QUALIFYING}` : eventId;
  const seedNumber = participant?.seedings?.[eventType]?.find(
    (scaleItem) => scaleItem.scaleName === scaleName,
  )?.scaleValue;

  const status = entryStatusMapping[entry.entryStatus];

  return {
    searchText: participant?.participantName.toLowerCase(),
    participant,
    seedNumber,
    cityState,
    ...entry,
    ratings,
    flights,
    status,
  };
}
