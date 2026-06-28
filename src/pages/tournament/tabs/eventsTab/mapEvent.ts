/**
 * Map event data with matchUps, draws, and entries.
 * Supports light mode to skip resource-intensive calculations for large event counts.
 */
import { publishingGovernor, drawDefinitionConstants } from 'tods-competition-factory';
import { acceptedEntryStatuses } from 'constants/acceptedEntryStatuses';
import { tournamentEngine } from 'services/factory/engine';
import { mapDrawDefinition } from './mapDrawDefinition';

const { MAIN } = drawDefinitionConstants;

export function mapEvent({
  lightMode = false,
  scaleValues,
  event,
}: {
  lightMode?: boolean;
  scaleValues?: any;
  event: any;
}): any {
  const { drawDefinitions = [], eventName, entries, eventId } = event;

  const ungeneratedFlights: any = [];
  const flightProfile = tournamentEngine.q.flightProfile({ event });
  flightProfile?.flights?.forEach((flight: any) => {
    const drawDefinition = drawDefinitions.find((dd: any) => dd.drawId === flight.drawId);
    if (drawDefinition) {
      drawDefinition.flightNumber = flight.flightNumber;
    } else {
      ungeneratedFlights.push({
        flightNumber: flight.flightNumber,
        entries: flight.drawEntries,
        drawName: flight.drawName,
        drawId: flight.drawId,
      });
    }
  });

  const publishState = publishingGovernor.getPublishState({ event }).publishState;
  const drawsCount = drawDefinitions.length;

  const entriesCount =
    entries.filter(({ entryStage = MAIN, entryStatus }: any) =>
      acceptedEntryStatuses(MAIN).includes(`${entryStage}.${entryStatus}`),
    )?.length || 0;

  let matchUpsCount = 0;
  let scheduledMatchUpsCount = 0;
  let completedMatchUpsCount = 0;

  let drawDefs: any[];

  if (lightMode) {
    drawDefs = [...drawDefinitions, ...ungeneratedFlights].map(
      ({ drawId, drawName, drawType, flightNumber, structures }: any) => ({
        generated: structures?.length > 0,
        flightNumber,
        drawName,
        drawType,
        eventId,
        drawId,
      }),
    );
  } else {
    // `inContext: false` — every column read below uses raw matchUp fields
    // (length, winningSide, schedule.scheduledTime). `inContext: true` was a
    // pre-5.0.0 leftover that hauled the full participant/draw/event blob
    // along for no reader. Dropping it shrinks the result substantially.
    const matchUps = tournamentEngine.q.eventMatchUps({ inContext: false, eventId });
    matchUpsCount = matchUps?.length || 0;
    scheduledMatchUpsCount =
      matchUps?.filter(({ winningSide, schedule }: any) => !winningSide && schedule?.scheduledTime)?.length || 0;
    completedMatchUpsCount = matchUps.filter(({ winningSide }: any) => winningSide)?.length || 0;
    drawDefs = [...drawDefinitions, ...ungeneratedFlights].map((drawDefinition: any) =>
      mapDrawDefinition(eventId)({ drawDefinition, scaleValues: scaleValues?.draws?.[drawDefinition.drawId] }),
    );
  }

  const searchText = [eventName]
    .concat([...drawDefinitions, ...ungeneratedFlights].map(({ drawName }: any) => drawName || ''))
    .join(' ')
    .toLowerCase();

  return {
    published: publishState?.status.published,
    scheduledMatchUpsCount,
    completedMatchUpsCount,
    matchUpsCount,
    entriesCount,
    drawsCount,
    searchText,
    drawDefs,
    eventId,
    event,
  };
}
