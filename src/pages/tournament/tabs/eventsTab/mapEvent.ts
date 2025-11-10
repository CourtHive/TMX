/**
 * Map event data with matchUps, draws, and entries.
 * Supports light mode to skip resource-intensive calculations for large event counts.
 */
import { tournamentEngine, publishingGovernor, drawDefinitionConstants } from 'tods-competition-factory';
import { acceptedEntryStatuses } from 'constants/acceptedEntryStatuses';
import { mapDrawDefinition } from './mapDrawDefinition';

const { MAIN } = drawDefinitionConstants;

export function mapEvent({ event, scaleValues, lightMode = false }: { event: any; scaleValues?: any; lightMode?: boolean }): any {
  const { drawDefinitions = [], eventName, entries, eventId } = event;

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
    drawDefs = drawDefinitions.map((drawDefinition: any) =>
      mapDrawDefinition(eventId)({ drawDefinition, scaleValues: scaleValues?.draws?.[drawDefinition.drawId] }),
    );
  }

  const searchText = [eventName]
    .concat(drawDefinitions.map(({ drawName }: any) => drawName || ''))
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
