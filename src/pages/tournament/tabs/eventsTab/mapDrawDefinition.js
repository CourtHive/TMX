import { tournamentEngine } from 'tods-competition-factory';

export const mapDrawDefinition =
  (eventId) =>
  ({ drawDefinition, scaleValues }) => {
    const { drawId, drawName, drawType, entries, matchUpFormat, tieFormat } = drawDefinition;

    const publishState = tournamentEngine.getPublishState({ drawId }).publishState;
    const published = publishState?.status?.published;
    const entriesCount = entries?.filter(({ entryStatus }) => entryStatus !== 'WITHDRAWN')?.length;
    const assignedParticipantIds = tournamentEngine
      .getAssignedParticipantIds({
        drawDefinition,
      })
      .assignedParticipantIds?.filter(Boolean);

    return {
      entries: assignedParticipantIds?.length ?? entriesCount ?? 0,
      matchUpFormat, // needs to default to event.tieFormat
      tieFormat, // needs to default to event.tieFormat
      utrAvg: scaleValues?.ratingsStats?.UTR?.avg,
      wtnAvg: scaleValues?.ratingsStats?.WTN?.avg,
      published,
      drawName,
      drawType,
      eventId,
      drawId,
    };
  };
