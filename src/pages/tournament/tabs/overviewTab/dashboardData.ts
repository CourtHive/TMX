import { tournamentEngine, competitionEngine, drawDefinitionConstants, factoryConstants } from 'tods-competition-factory';

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

  const tournamentName = tournamentRecord?.tournamentName || '';
  const startDate = tournamentRecord?.startDate || '';
  const endDate = tournamentRecord?.endDate || '';

  const imageUrl = tournamentRecord?.onlineResources?.find(
    (r: any) => r.name === 'tournamentImage' && r.resourceType === 'URL',
  )?.identifier;

  const notes = tournamentRecord?.notes;

  const participantCount =
    tournamentRecord?.participants?.filter((p: any) => p.participantType === 'INDIVIDUAL').length || 0;

  const events = tournamentRecord?.events || [];
  const eventCount = events.length;

  // MatchUp stats
  const { matchUps: allMatchUps = [] } = tournamentEngine.allTournamentMatchUps() || {};
  const nonByeMatchUps = allMatchUps.filter((m: any) => m.matchUpStatus !== 'BYE');
  const total = nonByeMatchUps.length;
  const completed = nonByeMatchUps.filter(
    (m: any) => completedMatchUpStatuses.includes(m.matchUpStatus) || m.winningSide,
  ).length;
  const { dateMatchUps = [] } = competitionEngine.competitionScheduleMatchUps() || {};
  const scheduled = dateMatchUps.length;
  const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Gather structures for sunburst selector by walking tournamentRecord directly
  const structures: StructureInfo[] = [];
  for (const event of events) {
    for (const drawDefinition of event.drawDefinitions || []) {
      for (const structure of drawDefinition.structures || []) {
        if (structure.structureType === ROUND_ROBIN || structure.structureType === CONTAINER) continue;
        structures.push({
          structureId: structure.structureId,
          structureName: structure.structureName || structure.stage || 'Main',
          drawId: drawDefinition.drawId,
          drawName: drawDefinition.drawName || '',
          eventName: event.eventName || '',
          eventId: event.eventId,
        });
      }
    }
  }

  return {
    tournamentName,
    startDate,
    endDate,
    imageUrl,
    notes,
    participantCount,
    eventCount,
    matchUpStats: { total, completed, scheduled, percentComplete },
    structures,
  };
}
