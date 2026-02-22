import { tournamentEngine, drawDefinitionConstants } from 'tods-competition-factory';

const { CONTAINER, ROUND_ROBIN } = drawDefinitionConstants;

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
  const tournamentInfo = tournamentEngine.getTournamentInfo({
    withStructureDetails: true,
    withPublishState: true,
    withMatchUpStats: true,
  }).tournamentInfo;

  const structures = (tournamentInfo?.structures || []).filter(
    (s: any) => s.structureType !== CONTAINER && s.structureType !== ROUND_ROBIN,
  );

  const info = {
    participantCount: tournamentInfo?.participantCount || tournamentInfo?.individualParticipantCount || 0,
    tournamentName: tournamentInfo?.tournamentName,
    matchUpStats: tournamentInfo?.matchUpStats,
    eventCount: tournamentInfo?.eventCount,
    startDate: tournamentInfo?.startDate,
    imageUrl: tournamentInfo?.imageUrl,
    endDate: tournamentInfo?.endDate,
    notes: tournamentInfo?.notes,
    structures,
  };

  return info;
}
