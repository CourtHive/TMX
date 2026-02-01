/**
 * Map event data with matchUps, draws, and entries.
 * Supports light mode to skip resource-intensive calculations for large event counts.
 */
import { acceptedEntryStatuses } from 'constants/acceptedEntryStatuses';
import { mapDrawDefinition } from './mapDrawDefinition';
import {
  tournamentEngine,
  publishingGovernor,
  drawDefinitionConstants,
  extensionConstants,
} from 'tods-competition-factory';

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
  const { drawDefinitions = [], eventName, entries, eventId, extensions } = event;

  const ungeneratedFlights: any = [];
  const flightProfile = extensions.find((ext: any) => ext.name === extensionConstants.FLIGHT_PROFILE)?.value;
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
  let drawDefs: any[] = [];

  if (!lightMode) {
    const matchUps = tournamentEngine.allEventMatchUps({ inContext: true, eventId }).matchUps;
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
