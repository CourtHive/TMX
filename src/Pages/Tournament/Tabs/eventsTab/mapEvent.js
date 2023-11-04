import { tournamentEngine, drawDefinitionConstants } from 'tods-competition-factory';
import { acceptedEntryStatuses } from 'constants/acceptedEntryStatuses';
import { mapDrawDefinition } from './mapDrawDefinition';

const { MAIN } = drawDefinitionConstants;

export function mapEvent({ event, scaleValues }) {
  const { drawDefinitions = [], eventName, entries, eventId } = event;

  const matchUps = tournamentEngine.allEventMatchUps({ inContext: true, eventId }).matchUps;

  const drawsCount = drawDefinitions.length;
  const entriesCount =
    entries.filter(({ entryStage = MAIN, entryStatus }) =>
      acceptedEntryStatuses(MAIN).includes(`${entryStage}.${entryStatus}`)
    )?.length || 0;
  const matchUpsCount = matchUps?.length || 0;
  const scheduledMatchUpsCount =
    matchUps?.filter(({ winningSide, schedule }) => !winningSide && schedule?.scheduledTime)?.length || 0;
  const completedMatchUpsCount = matchUps.filter(({ winningSide }) => winningSide)?.length || 0;
  const drawDefs = drawDefinitions.map((drawDefinition) =>
    mapDrawDefinition(eventId)({ drawDefinition, scaleValues: scaleValues?.draws?.[drawDefinition.drawId] })
  );

  const searchText = [eventName]
    .concat(drawDefinitions.map(({ drawName }) => drawName || ''))
    .join(' ')
    .toLowerCase();

  return {
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
    event
  };
}
