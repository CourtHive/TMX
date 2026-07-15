/**
 * Map draw definition with publish state and scale values.
 * Returns draw metadata including entries count, ratings averages, and formats.
 */
import { publishingGovernor, entryStatusConstants } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';
import { describeDrawType } from './describeDrawType';

// constants
const { WITHDRAWN } = entryStatusConstants;

export const mapDrawDefinition =
  (eventId: string) =>
  ({ drawDefinition, scaleValues }: { drawDefinition: any; scaleValues?: any }): any => {
    const { drawId, drawName, drawType, entries, matchUpFormat, tieFormat, structures, flightNumber } = drawDefinition;

    const publishState = tournamentEngine.q.publishState({ drawId });
    const published = publishState?.status?.published;
    const drawDetail = publishState?.status?.drawDetails?.[drawId]?.publishingDetail;
    const embargoActive = publishingGovernor.isEmbargoed(drawDetail);
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
      embargoActive,
      published,
      drawName,
      drawType,
      // Composite-aware display label — `drawType` alone hides an RR qualifying
      // under a SINGLE_ELIMINATION main (see describeDrawType).
      drawTypeLabel: describeDrawType(drawDefinition),
      eventId,
      drawId,
    };
  };
