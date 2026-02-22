import {
  tournamentEngine,
  competitionEngine,
  drawDefinitionConstants,
  factoryConstants,
} from 'tods-competition-factory';

const { CONTAINER, ROUND_ROBIN } = drawDefinitionConstants;
const { completedMatchUpStatuses } = factoryConstants;

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

export type DashboardData = {
  tournamentName: string;
  startDate: string;
  endDate: string;
  imageUrl?: string;
  notes?: string;
  participantCount: number;
  eventCount: number;
  matchUpStats: MatchUpStats;
  structures: StructureInfo[];
};

export function getDashboardData(): DashboardData {
  const { tournamentRecord } = tournamentEngine.getTournament();

  const imageUrl = tournamentRecord?.onlineResources?.find(
    (r: any) => r.name === 'tournamentImage' && r.resourceType === 'URL',
  )?.identifier;

  const tournamentInfo = tournamentEngine.getTournamentInfo({
    withStructureDetails: true,
    withPublishState: true,
    withMatchUpStats: true,
  }).tournamentInfo;

  const local = { imageUrl };

  const structures = (tournamentInfo?.structures || []).filter(
    (s: any) => s.structureType !== CONTAINER && s.structureType !== ROUND_ROBIN,
  );

  const info = {
    participantCount: tournamentInfo?.participantCount || tournamentInfo?.individualParticipantCount || 0,
    tournamentName: tournamentInfo?.tournamentName,
    matchUpStats: tournamentInfo?.matchUpStats,
    eventCount: tournamentInfo?.eventCount,
    startDate: tournamentInfo?.startDate,
    endDate: tournamentInfo?.endDate,
    notes: tournamentInfo?.notes,
    structures,
    ...local,
  };

  console.log({ tournamentInfo, local, info });

  return info;
}
