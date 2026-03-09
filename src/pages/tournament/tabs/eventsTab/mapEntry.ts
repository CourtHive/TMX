/**
 * Map event entry with participant details, ratings, rankings, and seeding.
 * Combines entry data with participant information for display in entries tables.
 * Dynamically collects all ratings present in participant data.
 */
import { drawDefinitionConstants, factoryConstants, fixtures } from 'tods-competition-factory';

// constants
import { entryStatusMapping } from 'constants/tmxConstants';
const { ratingsParameters } = fixtures;
const { TEAM } = factoryConstants.eventConstants;
const { QUALIFYING } = drawDefinitionConstants;

type MapEntryParams = {
  entry: any;
  derivedDrawInfo?: any;
  participantDrawsMap?: Record<string, { drawId: string; drawName: string }[]>;
  drawPositionMap?: Record<string, number>;
  participants?: any[];
  participant?: any;
  eventType: string;
  categoryName?: string;
  eventId: string;
};

export function mapEntry({
  entry,
  derivedDrawInfo,
  participantDrawsMap,
  drawPositionMap,
  participants,
  participant,
  eventType,
  categoryName,
  eventId,
}: MapEntryParams): any {
  participant = participant || participants?.find((p) => p.participantId === entry.participantId);

  // Use participantDrawsMap (built from drawDefinition entries) if available,
  // otherwise fall back to participant.draws from the factory
  const flights = participantDrawsMap?.[entry.participantId] ??
    participant?.draws
      ?.filter((flight: any) => flight.eventId === eventId)
      .map((flight: any) => ({ ...flight, drawName: derivedDrawInfo?.[flight.drawId]?.drawName })) ?? [];
  const address = participant?.person?.addresses?.[0];
  const cityState = address ? `${address.city}, ${address.state}` : undefined;

  const ratingType = eventType === TEAM ? 'AVERAGE' : eventType;
  const ratings: Record<string, any> = {};
  for (const item of participant?.ratings?.[ratingType] || []) {
    const key = item.scaleName.toLowerCase();
    const params = ratingsParameters[item.scaleName.toUpperCase()];
    const accessor = params?.accessor || `${key}Rating`;

    if (typeof item.scaleValue === 'object' && item.scaleValue !== null) {
      ratings[key] = item.scaleValue;
    } else {
      ratings[key] = { [accessor]: item.scaleValue };
    }
  }

  const ranking = participant?.rankings?.[eventType]?.find(
    (ranking: any) => ranking.scaleName === categoryName,
  )?.scaleValue;

  const scaleName = entry.entryStage === QUALIFYING ? `${eventId}${QUALIFYING}` : eventId;
  const seedNumber = participant?.seedings?.[eventType]?.find(
    (scaleItem: any) => scaleItem.scaleName === scaleName,
  )?.scaleValue;

  const status = (entryStatusMapping as any)[entry.entryStatus];
  const drawPosition = drawPositionMap?.[entry.participantId];

  return {
    searchText: participant?.participantName.toLowerCase(),
    drawPosition,
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
