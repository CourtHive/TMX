/**
 * Data aggregation for the publishing tab.
 * Queries factory publish state and structures it for the UI.
 */
import { tournamentEngine, publishingGovernor, tools } from 'tods-competition-factory';
import { t } from 'i18n';

const PUB_ROUND_KEY = 'publishing.round';

export type PublishingRowData = {
  id: string;
  name: string;
  type: 'event' | 'draw' | 'round';
  eventId: string;
  drawId?: string;
  structureId?: string;
  roundNumber?: number;
  roundLimit?: number;
  scheduleEmbargo?: string;
  scheduleEmbargoActive?: boolean;
  published: boolean;
  embargo?: string;
  embargoActive: boolean;
  publishState: 'live' | 'embargoed' | 'off';
  _children?: PublishingRowData[];
};

export type EmbargoEntry = {
  type: string;
  label: string;
  embargo: string;
  embargoActive: boolean;
  eventId?: string;
  drawId?: string;
};

export type TournamentPublishData = {
  oopPublished: boolean;
  oopEmbargo?: string;
  oopEmbargoActive: boolean;
  oopScheduledDates?: string[];
  participantsPublished: boolean;
  participantsEmbargo?: string;
  participantsEmbargoActive: boolean;
  participantsColumns?: { country?: boolean; events?: boolean; ratings?: string[]; rankings?: string[] };
  publishLanguage?: string;
  tournamentDateRange: string[];
  startDate: string;
  endDate: string;
};

export function getTournamentPublishData(): TournamentPublishData {
  const publishState = tournamentEngine.getPublishState()?.publishState;
  const tournamentPubState = publishState?.tournament;
  const { startDate, endDate } = tournamentEngine.getCompetitionDateRange();

  const oopEmbargo = tournamentPubState?.orderOfPlay?.embargo;
  const participantsEmbargo = tournamentPubState?.participants?.embargo;

  return {
    oopPublished: !!tournamentPubState?.orderOfPlay?.published,
    oopEmbargo,
    oopEmbargoActive: oopEmbargo ? new Date(oopEmbargo).getTime() > Date.now() : false,
    oopScheduledDates: tournamentPubState?.orderOfPlay?.scheduledDates,
    participantsPublished: !!tournamentPubState?.participants?.published,
    participantsEmbargo,
    participantsEmbargoActive: participantsEmbargo
      ? new Date(participantsEmbargo).getTime() > Date.now()
      : false,
    participantsColumns: tournamentPubState?.participants?.columns,
    publishLanguage: tournamentPubState?.language,
    tournamentDateRange: startDate && endDate ? tools.generateDateRange(startDate, endDate) : [],
    startDate,
    endDate,
  };
}

function resolvePublishState(published: boolean, embargo?: string): 'live' | 'embargoed' | 'off' {
  if (!published) return 'off';
  if (embargo && new Date(embargo).getTime() > Date.now()) return 'embargoed';
  return 'live';
}

export function getPublishingTableData(): PublishingRowData[] {
  const events = tournamentEngine.getEvents()?.events || [];
  const rows: PublishingRowData[] = [];

  for (const event of events) {
    const eventPubState = publishingGovernor.getPublishState({ event })?.publishState;
    const drawDetails = eventPubState?.status?.drawDetails || {};
    const eventPublished = !!eventPubState?.status?.published;
    const drawDefinitions = event.drawDefinitions || [];

    const children: PublishingRowData[] = drawDefinitions.map((dd: any) => {
      const detail = drawDetails[dd.drawId]?.publishingDetail;
      const published = detail?.published ?? eventPublished;
      const embargo = detail?.embargo;

      const drawRow: PublishingRowData = {
        id: dd.drawId,
        name: dd.drawName || dd.drawId,
        type: 'draw' as const,
        eventId: event.eventId,
        drawId: dd.drawId,
        published,
        embargo,
        embargoActive: embargo ? new Date(embargo).getTime() > Date.now() : false,
        publishState: resolvePublishState(published, embargo),
      };

      // Build round children from structureDetails
      const structureDetails = drawDetails[dd.drawId]?.structureDetails || {};
      const roundChildren: PublishingRowData[] = [];

      for (const [structureId, sd] of Object.entries(structureDetails) as [string, any][]) {
        // Round rows hidden by roundLimit
        if (sd?.roundLimit != null) {
          const structure = dd.structures?.find((s: any) => s.structureId === structureId);
          const matchUps = structure?.matchUps || [];
          const maxRound = matchUps.reduce((max: number, m: any) => Math.max(max, m.roundNumber || 0), 0);
          for (let rn = sd.roundLimit + 1; rn <= maxRound; rn++) {
            roundChildren.push({
              id: `${dd.drawId}:${structureId}:round${rn}`,
              name: `${t(PUB_ROUND_KEY)} ${rn}`,
              type: 'round',
              eventId: event.eventId,
              drawId: dd.drawId,
              structureId,
              roundNumber: rn,
              roundLimit: sd.roundLimit,
              published: false,
              embargo: undefined,
              embargoActive: false,
              publishState: 'off',
            });
          }
        }

        // Round rows with schedule embargo
        const scheduledRounds = sd?.scheduledRounds || {};
        for (const [rn, rd] of Object.entries(scheduledRounds) as [string, any][]) {
          if (rd?.embargo && new Date(rd.embargo).getTime() > Date.now()) {
            roundChildren.push({
              id: `${dd.drawId}:${structureId}:sched${rn}`,
              name: `${t(PUB_ROUND_KEY)} ${rn} ${t('publishing.roundSchedule').toLowerCase()}`,
              type: 'round',
              eventId: event.eventId,
              drawId: dd.drawId,
              structureId,
              roundNumber: parseInt(rn),
              scheduleEmbargo: rd.embargo,
              scheduleEmbargoActive: true,
              published: true,
              embargo: undefined,
              embargoActive: false,
              publishState: 'embargoed',
            });
          }
        }
      }

      if (roundChildren.length) drawRow._children = roundChildren;

      return drawRow;
    });

    rows.push({
      id: event.eventId,
      name: event.eventName,
      type: 'event',
      eventId: event.eventId,
      published: eventPublished,
      embargo: undefined,
      embargoActive: false,
      publishState: eventPublished ? 'live' : 'off',
      _children: children.length ? children : undefined,
    });
  }

  return rows;
}

export function getActiveEmbargoes(): EmbargoEntry[] {
  const embargoes: EmbargoEntry[] = [];
  const publishState = tournamentEngine.getPublishState()?.publishState;
  const tournamentPubState = publishState?.tournament;

  if (tournamentPubState?.orderOfPlay?.embargo) {
    const embargo = tournamentPubState.orderOfPlay.embargo;
    const embargoActive = new Date(embargo).getTime() > Date.now();
    if (embargoActive) {
      embargoes.push({ type: 'orderOfPlay', label: t('publishing.orderOfPlay'), embargo, embargoActive });
    }
  }

  if (tournamentPubState?.participants?.embargo) {
    const embargo = tournamentPubState.participants.embargo;
    const embargoActive = new Date(embargo).getTime() > Date.now();
    if (embargoActive) {
      embargoes.push({ type: 'participants', label: t('publishing.participants'), embargo, embargoActive });
    }
  }

  const events = tournamentEngine.getEvents()?.events || [];
  for (const event of events) {
    const eventPubState = publishingGovernor.getPublishState({ event })?.publishState;
    const drawDetails = eventPubState?.status?.drawDetails || {};

    for (const [drawId, details] of Object.entries(drawDetails) as [string, any][]) {
      const detail = details?.publishingDetail;
      if (detail?.embargo) {
        const embargoActive = new Date(detail.embargo).getTime() > Date.now();
        if (embargoActive) {
          const drawDef = event.drawDefinitions?.find((dd: any) => dd.drawId === drawId);
          embargoes.push({
            type: 'draw',
            label: `${event.eventName} — ${drawDef?.drawName || drawId}`,
            embargo: detail.embargo,
            embargoActive,
            eventId: event.eventId,
            drawId,
          });
        }
      }

      // Round-level schedule embargoes from structureDetails
      const structureDetails = details?.structureDetails || {};
      for (const [, sd] of Object.entries(structureDetails) as [string, any][]) {
        const scheduledRounds = sd?.scheduledRounds || {};
        for (const [roundNumber, rd] of Object.entries(scheduledRounds) as [string, any][]) {
          if (rd?.embargo && new Date(rd.embargo).getTime() > Date.now()) {
            const drawDef = event.drawDefinitions?.find((dd: any) => dd.drawId === drawId);
            embargoes.push({
              type: 'scheduledRound',
              label: `${event.eventName} — ${drawDef?.drawName || drawId} — ${t(PUB_ROUND_KEY)} ${roundNumber} ${t('publishing.roundSchedule').toLowerCase()}`,
              embargo: rd.embargo,
              embargoActive: true,
              eventId: event.eventId,
              drawId,
            });
          }
        }
      }
    }
  }

  embargoes.sort((a, b) => new Date(a.embargo).getTime() - new Date(b.embargo).getTime());
  return embargoes;
}
