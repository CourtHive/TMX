import { tournamentEngine, publishingGovernor, drawDefinitionConstants } from 'tods-competition-factory';
import { acceptedEntryStatuses } from 'constants/acceptedEntryStatuses';
import { mapDrawDefinition } from './mapDrawDefinition';

const { MAIN } = drawDefinitionConstants;

export function mapEvent({ event, scaleValues, lightMode = false }) {
  const { drawDefinitions = [], eventName, entries, eventId } = event;

  const publishState = publishingGovernor.getPublishState({ event }).publishState;
  const drawsCount = drawDefinitions.length;
  
  const entriesCount =
    entries.filter(({ entryStage = MAIN, entryStatus }) =>
      acceptedEntryStatuses(MAIN).includes(`${entryStage}.${entryStatus}`),
    )?.length || 0;

  // Skip resource-intensive calculations in light mode
  let matchUpsCount = 0;
  let scheduledMatchUpsCount = 0;
  let completedMatchUpsCount = 0;
  let drawDefs = [];

  if (!lightMode) {
    const matchUps = tournamentEngine.allEventMatchUps({ inContext: true, eventId }).matchUps;
    matchUpsCount = matchUps?.length || 0;
    scheduledMatchUpsCount =
      matchUps?.filter(({ winningSide, schedule }) => !winningSide && schedule?.scheduledTime)?.length || 0;
    completedMatchUpsCount = matchUps.filter(({ winningSide }) => winningSide)?.length || 0;
    drawDefs = drawDefinitions.map((drawDefinition) =>
      mapDrawDefinition(eventId)({ drawDefinition, scaleValues: scaleValues?.draws?.[drawDefinition.drawId] }),
    );
  }

  const searchText = [eventName]
    .concat(drawDefinitions.map(({ drawName }) => drawName || ''))
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
    // startDate, // => event.startDate needs to default to tournament startDate
    drawDefs,
    eventId,
    // endDate, //  => event.endDate to default to tournament endDate
    event,
  };
}
