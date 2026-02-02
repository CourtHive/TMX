/**
 * Map draw definition with publish state and scale values.
 * Returns draw metadata including entries count, ratings averages, and formats.
 */
import { tournamentEngine, entryStatusConstants } from 'tods-competition-factory';

// constants
const { WITHDRAWN } = entryStatusConstants;

export const mapDrawDefinition =
  (eventId: string) =>
  ({ drawDefinition, scaleValues }: { drawDefinition: any; scaleValues?: any }): any => {
    const { drawId, drawName, drawType, entries, matchUpFormat, tieFormat, structures, flightNumber } = drawDefinition;

    const publishState = tournamentEngine.getPublishState({ drawId }).publishState;
    const published = publishState?.status?.published;
    const entriesCount = entries?.filter(({ entryStatus }: any) => entryStatus !== WITHDRAWN)?.length;
    const assignedParticipantIds = tournamentEngine
      .getAssignedParticipantIds({
        drawDefinition,
      })
      .assignedParticipantIds?.filter(Boolean);

    const entriesDisplayCount = (assignedParticipantIds?.length || entriesCount) ?? 0;

    return {
      utrAvg: scaleValues?.ratingsStats?.UTR?.avg,
      wtnAvg: scaleValues?.ratingsStats?.WTN?.avg,
      generated: structures?.length > 0,
      entries: entriesDisplayCount,
      matchUpFormat,
      flightNumber,
      tieFormat,
      published,
      drawName,
      drawType,
      eventId,
      drawId,
    };
  };
