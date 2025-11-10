/**
 * Map draw definition with publish state and scale values.
 * Returns draw metadata including entries count, ratings averages, and formats.
 */
import { tournamentEngine } from 'tods-competition-factory';

export const mapDrawDefinition =
  (eventId: string) =>
  ({ drawDefinition, scaleValues }: { drawDefinition: any; scaleValues?: any }): any => {
    const { drawId, drawName, drawType, entries, matchUpFormat, tieFormat } = drawDefinition;

    const publishState = tournamentEngine.getPublishState({ drawId }).publishState;
    const published = publishState?.status?.published;
    const entriesCount = entries?.filter(({ entryStatus }: any) => entryStatus !== 'WITHDRAWN')?.length;
    const assignedParticipantIds = tournamentEngine
      .getAssignedParticipantIds({
        drawDefinition,
      })
      .assignedParticipantIds?.filter(Boolean);

    return {
      entries: assignedParticipantIds?.length ?? entriesCount ?? 0,
      matchUpFormat,
      tieFormat,
      utrAvg: scaleValues?.ratingsStats?.UTR?.avg,
      wtnAvg: scaleValues?.ratingsStats?.WTN?.avg,
      published,
      drawName,
      drawType,
      eventId,
      drawId,
    };
  };
