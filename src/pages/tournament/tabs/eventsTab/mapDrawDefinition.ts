/**
 * Map draw definition with publish state and scale values.
 * Returns draw metadata including entries count, ratings averages, and formats.
 */
import { tournamentEngine } from 'tods-competition-factory';

export const mapDrawDefinition =
  (eventId: string) =>
  ({ drawDefinition, scaleValues }: { drawDefinition: any; scaleValues?: any }): any => {
    const { drawId, drawName, drawType, entries, matchUpFormat, tieFormat, structures } = drawDefinition;

    const publishState = tournamentEngine.getPublishState({ drawId }).publishState;
    const published = publishState?.status?.published;
    const entriesCount = entries?.filter(({ entryStatus }: any) => entryStatus !== 'WITHDRAWN')?.length;
    const assignedParticipantIds = tournamentEngine
      .getAssignedParticipantIds({
        drawDefinition,
      })
      .assignedParticipantIds?.filter(Boolean);

    const entriesDisplayCount = (assignedParticipantIds?.length || entriesCount) ?? 0;

    return {
      utrAvg: scaleValues?.ratingsStats?.UTR?.avg,
      wtnAvg: scaleValues?.ratingsStats?.WTN?.avg,
      flightNumber: drawDefinition.flightNumber,
      entries: entriesDisplayCount,
      generated: structures?.length > 0,
      matchUpFormat,
      tieFormat,
      published,
      drawName,
      drawType,
      eventId,
      drawId,
    };
  };
