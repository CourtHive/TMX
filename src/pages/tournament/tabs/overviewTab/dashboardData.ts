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
  structure: any;
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
    tournamentEngine.getParticipants({ participantFilters: { participantTypes: ['INDIVIDUAL'] } }).participants
      ?.length || 0;

  const events = tournamentEngine.getEvents().events || [];
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

  // Gather structures for sunburst (filter out ROUND_ROBIN and CONTAINER)
  const structures: StructureInfo[] = [];
  for (const event of events) {
    const eventData = tournamentEngine.getEventData({ eventId: event.eventId })?.eventData;
    if (!eventData?.drawsData) continue;

    for (const draw of eventData.drawsData) {
      for (const structure of draw.structures || []) {
        if (structure.structureType === ROUND_ROBIN || structure.structureType === CONTAINER) continue;
        structures.push({
          structureId: structure.structureId,
          structureName: structure.structureName || structure.stage || 'Main',
          drawId: draw.drawId,
          drawName: draw.drawName || '',
          eventName: eventData.eventInfo?.eventName || '',
          eventId: event.eventId,
          structure,
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
