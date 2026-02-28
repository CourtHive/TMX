/**
 * Map event entry with participant details, ratings, rankings, and seeding.
 * Combines entry data with participant information for display in entries tables.
 * Dynamically collects all ratings present in participant data.
 */
import { drawDefinitionConstants, factoryConstants, fixtures } from 'tods-competition-factory';

// constants
import { entryStatusMapping } from 'constants/tmxConstants';
const { ratingsParameters } = fixtures;
const { TEAM, SINGLES } = factoryConstants.eventConstants;
const { PAIR } = factoryConstants.participantConstants;
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
  const ratings: Record<string, any> = {};

  if (participant?.participantType === PAIR && participant?.individualParticipants?.length) {
    // Aggregate individual SINGLES ratings for PAIR participants
    const individuals = participant.individualParticipants;
    const allScaleNames = new Set<string>();
    for (const ind of individuals) {
      for (const item of ind.ratings?.[SINGLES] || []) {
        allScaleNames.add(item.scaleName);
      }
    }

    for (const scaleName of allScaleNames) {
      const key = scaleName.toLowerCase();
      const params = ratingsParameters[scaleName.toUpperCase()];
      const accessor = params?.accessor || `${key}Rating`;
      const indRatings = individuals
        .map((ind: any) => ind.ratings?.[SINGLES]?.find((r: any) => r.scaleName === scaleName))
        .filter(Boolean);

      if (indRatings.length === 2) {
        const sv0 = indRatings[0].scaleValue;
        const sv1 = indRatings[1].scaleValue;
        if (typeof sv0 === 'object' && sv0 !== null && typeof sv1 === 'object' && sv1 !== null) {
          const valueKey = accessor in sv0 ? accessor : 'value';
          ratings[key] = {
            ...sv0,
            [valueKey]: ((sv0[valueKey] ?? 0) + (sv1[valueKey] ?? 0)) / 2,
            ...(sv0.confidence != null && { confidence: Math.min(sv0.confidence ?? 0, sv1.confidence ?? 0) }),
          };
        } else {
          ratings[key] = { [accessor]: ((sv0 ?? 0) + (sv1 ?? 0)) / 2 };
        }
      } else if (indRatings.length === 1) {
        const sv = indRatings[0].scaleValue;
        ratings[key] = typeof sv === 'object' && sv !== null ? sv : { [accessor]: sv };
      }
    }
  } else {
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
  }

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
