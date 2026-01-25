/**
 * Map event entry with participant details, ratings, rankings, and seeding.
 * Combines entry data with participant information for display in entries tables.
 */
import { drawDefinitionConstants, factoryConstants } from 'tods-competition-factory';
import { entryStatusMapping } from 'constants/tmxConstants';

const { WTN, UTR } = factoryConstants.ratingConstants;
const { TEAM } = factoryConstants.eventConstants;
const { QUALIFYING } = drawDefinitionConstants;

type MapEntryParams = {
  entry: any;
  derivedDrawInfo?: any;
  participants?: any[];
  participant?: any;
  eventType: string;
  categoryName?: string;
  eventId: string;
};

export function mapEntry({
  entry,
  derivedDrawInfo,
  participants,
  participant,
  eventType,
  categoryName,
  eventId,
}: MapEntryParams): any {
  participant = participant || participants?.find((p) => p.participantId === entry.participantId);
  const flights =
    participant?.draws
      ?.filter((flight: any) => flight.eventId === eventId)
      .map((flight: any) => ({ ...flight, drawName: derivedDrawInfo[flight.drawId].drawName })) ?? [];
  const address = participant?.person?.addresses?.[0];
  const cityState = address ? `${address.city}, ${address.state}` : undefined;

  const ratingType = eventType === TEAM ? 'AVERAGE' : eventType;
  const wtn = participant?.ratings?.[ratingType]?.find((rating: any) => rating.scaleName === WTN)?.scaleValue;
  const utr = participant?.ratings?.[ratingType]?.find((rating: any) => rating.scaleName === UTR)?.scaleValue;
  const ratings = { wtn, utr };

  const ranking = participant?.rankings?.[eventType]?.find(
    (ranking: any) => ranking.scaleName === categoryName,
  )?.scaleValue;

  const scaleName = entry.entryStage === QUALIFYING ? `${eventId}${QUALIFYING}` : eventId;
  const seedNumber = participant?.seedings?.[eventType]?.find(
    (scaleItem: any) => scaleItem.scaleName === scaleName,
  )?.scaleValue;

  const status = (entryStatusMapping as any)[entry.entryStatus];

  return {
    searchText: participant?.participantName.toLowerCase(),
    participant,
    seedNumber,
    cityState,
    ...entry,
    ranking,
    ratings,
    flights,
    status,
  };
}
