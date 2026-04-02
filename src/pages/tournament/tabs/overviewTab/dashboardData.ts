import { tournamentEngine, publishingGovernor, drawDefinitionConstants } from 'tods-competition-factory';
import { COURT_SVG_RESOURCE_SUB_TYPE } from 'services/courtSvg/courtSvgUtil';

const { CONTAINER, ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF, LUCKY_DRAW, AD_HOC } = drawDefinitionConstants;

export type StructureInfo = {
  structureId: string;
  structureName: string;
  drawId: string;
  drawName: string;
  eventName: string;
  eventId: string;
};

export type MatchUpStats = {
  total: number;
  completed: number;
  scheduled: number;
  percentComplete: number;
};

export type PublishingStats = {
  publishedDraws: number;
  totalDraws: number;
  oopPublished: boolean;
  participantsPublished: boolean;
  activeEmbargoes: number;
};

export type DashboardData = {
  tournamentName: string;
  startDate: string;
  endDate: string;
  imageUrl?: string;
  courtSvgSport?: string;
  notes?: string;
  participantCount: number;
  teamParticipantCount: number;
  eventCount: number;
  drawDefinitionCount: number;
  matchUpStats: MatchUpStats;
  publishingStats: PublishingStats;
  structures: StructureInfo[];
};

export function getDashboardData(): DashboardData {
  const tournamentInfo = tournamentEngine.getTournamentInfo({
    withStructureDetails: true,
    withPublishState: true,
    withMatchUpStats: true,
  }).tournamentInfo;

  const structures = (tournamentInfo?.structures || []).filter(
    (s: any) =>
      s.structureType !== CONTAINER &&
      ![ROUND_ROBIN_WITH_PLAYOFF, ROUND_ROBIN, LUCKY_DRAW, AD_HOC].includes(s.drawType),
  );

  const drawDefinitionCount =
    tournamentInfo?.eventInfo?.reduce((count: number, event: any) => count + (event.drawDefinitionCount || 0), 0) || 0;

  // Compute publishing statistics
  const publishState = tournamentEngine.getPublishState()?.publishState;
  const tournamentPubState = publishState?.tournament;

  let publishedDraws = 0;
  let totalDraws = 0;
  let activeEmbargoes = 0;

  const events = tournamentEngine.getEvents()?.events || [];
  for (const event of events) {
    const eventPubState = publishingGovernor.getPublishState({ event })?.publishState;
    const drawDetails = eventPubState?.status?.drawDetails;
    const drawDefs = event.drawDefinitions || [];
    totalDraws += drawDefs.length;

    if (drawDetails) {
      for (const drawDef of drawDefs) {
        const detail = drawDetails[drawDef.drawId];
        if (detail?.publishingDetail?.published) publishedDraws++;
        if (publishingGovernor.isEmbargoed(detail?.publishingDetail)) {
          activeEmbargoes++;
        }
      }
    } else if (eventPubState?.status?.published) {
      publishedDraws += drawDefs.length;
    }
  }

  if (publishingGovernor.isEmbargoed(tournamentPubState?.orderOfPlay)) activeEmbargoes++;
  if (publishingGovernor.isEmbargoed(tournamentPubState?.participants)) activeEmbargoes++;

  const publishingStats: PublishingStats = {
    publishedDraws,
    totalDraws,
    oopPublished: !!tournamentPubState?.orderOfPlay?.published,
    participantsPublished: !!tournamentPubState?.participants?.published,
    activeEmbargoes,
  };

  // Factory only returns imageUrl for URL resources; check for court SVG separately
  const tournamentRecord = tournamentEngine.getTournament().tournamentRecord;
  const courtSvgResource = tournamentRecord?.onlineResources?.find(
    (r: any) => r.name === 'tournamentImage' && r.resourceSubType === COURT_SVG_RESOURCE_SUB_TYPE,
  );

  const info = {
    participantCount: tournamentInfo?.participantCount || tournamentInfo?.individualParticipantCount || 0,
    teamParticipantCount: tournamentInfo?.teamParticipantCount || 0,
    courtSvgSport: courtSvgResource?.identifier,
    tournamentName: tournamentInfo?.tournamentName,
    matchUpStats: tournamentInfo?.matchUpStats,
    eventCount: tournamentInfo?.eventCount,
    startDate: tournamentInfo?.startDate,
    imageUrl: tournamentInfo?.imageUrl,
    endDate: tournamentInfo?.endDate,
    notes: tournamentInfo?.notes,
    drawDefinitionCount,
    publishingStats,
    structures,
  };

  return info;
}
