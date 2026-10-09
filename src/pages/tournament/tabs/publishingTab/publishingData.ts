/**
 * Data aggregation for the publishing tab.
 * Queries factory publish state and structures it for the UI.
 */
import { publishingGovernor, tools } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';
import { t } from 'i18n';

const PUB_ROUND_KEY = 'publishing.round';

function getTournamentDateRange(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate) return [];
  const fullRange = tools.generateDateRange(startDate, endDate);
  const activeDates = tournamentEngine.q.tournament()?.activeDates as string[] | undefined;
  if (activeDates?.length) {
    const activeSet = new Set(activeDates);
    return fullRange.filter((d: string) => activeSet.has(d));
  }
  return fullRange;
}

export type PublishingRowData = {
  id: string;
  name: string;
  type: 'event' | 'draw' | 'structure' | 'round';
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
  /** Start this row expanded in the tree; draws open only when their structures are published selectively. */
  expanded?: boolean;
  _children?: PublishingRowData[];
};

export type EmbargoEntry = {
  type: string;
  label: string;
  embargo: string;
  embargoActive: boolean;
  eventId?: string;
  drawId?: string;
  structureId?: string;
  roundNumber?: string;
};

export type TournamentPublishData = {
  infoPublished: boolean;
  infoEventIds?: string[];
  /** ISO instant the information publish is withheld until, when one was set (P23 D4b). */
  infoEmbargo?: string;
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
  const publishState = tournamentEngine.q.publishState();
  const tournamentPubState = publishState?.tournament;
  const { startDate, endDate } = tournamentEngine.getCompetitionDateRange();

  const oopEmbargo = tournamentPubState?.orderOfPlay?.embargo;
  const participantsEmbargo = tournamentPubState?.participants?.embargo;

  return {
    // The information publish (factory 7.0.0) — the tournament itself, before anything inside it.
    // `eventIds` scopes which events the public information page lists; absent means every event.
    infoPublished: !!tournamentPubState?.info?.published,
    infoEventIds: tournamentPubState?.info?.eventIds,
    infoEmbargo: tournamentPubState?.info?.embargo,
    oopPublished: !!tournamentPubState?.orderOfPlay?.published,
    oopEmbargo,
    oopEmbargoActive: publishingGovernor.isEmbargoed(tournamentPubState?.orderOfPlay),
    oopScheduledDates: tournamentPubState?.orderOfPlay?.scheduledDates,
    participantsPublished: !!tournamentPubState?.participants?.published,
    participantsEmbargo,
    participantsEmbargoActive: publishingGovernor.isEmbargoed(tournamentPubState?.participants),
    participantsColumns: tournamentPubState?.participants?.columns,
    publishLanguage: tournamentPubState?.language,
    tournamentDateRange: getTournamentDateRange(startDate ?? '', endDate ?? ''),
    startDate: startDate ?? '',
    endDate: endDate ?? '',
  };
}

/**
 * The `eventIds` to send with a tournament-information publish.
 *
 * Every event selected means "list them all", which is the factory's own default — so send NO
 * `eventIds` rather than the full list. The distinction is not cosmetic: an explicit list freezes the
 * scope, and an event added tomorrow would silently stay off the information page. An empty selection
 * is treated the same way, because publishing information that lists nothing is never the intent.
 */
export function infoScopeParams(selectedEventIds: string[], allEventIds: string[]): { eventIds?: string[] } {
  const allSelected = allEventIds.length > 0 && selectedEventIds.length === allEventIds.length;
  return allSelected || !selectedEventIds.length ? {} : { eventIds: selectedEventIds };
}

export function resolvePublishState(published: boolean, embargo?: string): 'live' | 'embargoed' | 'off' {
  if (!published) return 'off';
  if (embargo && new Date(embargo).getTime() > Date.now()) return 'embargoed';
  return 'live';
}

/**
 * Is a structure published by intent, within its draw?
 *
 * An empty `structureDetails` means every structure is published (the draw is published whole). Once
 * any structure is keyed, a structure with NO detail is hidden: that is how `getEventData` and the read
 * model judge it, so TMX must never leave a structure unkeyed (see `mergeStructureDetails`).
 */
export function isStructurePublished(structureDetails: Record<string, any> | undefined, structureId: string): boolean {
  if (!structureDetails || !Object.keys(structureDetails).length) return true;
  return !!structureDetails[structureId]?.published;
}

/**
 * The complete `structureDetails` to send for a draw: one entry for EVERY structure, each carrying its
 * existing detail (embargo, roundLimit, scheduledRounds) and its current published intent, then passed
 * through `update`.
 *
 * Sending a partial map would replace the stored one, and every structure missing from it would vanish
 * from the public view.
 */
export function mergeStructureDetails({
  structureDetails,
  structureIds,
  update,
}: {
  structureDetails?: Record<string, any>;
  structureIds: string[];
  update?: (structureId: string, detail: Record<string, any>) => Record<string, any>;
}): Record<string, any> {
  const merged: Record<string, any> = {};
  for (const structureId of structureIds) {
    const detail = {
      ...structureDetails?.[structureId],
      published: isStructurePublished(structureDetails, structureId),
    };
    merged[structureId] = update ? update(structureId, detail) : detail;
  }
  return merged;
}

/** The latest of the active embargoes: a structure is visible only once every level above it has lifted. */
function latestEmbargo(...embargoes: (string | undefined)[]): string | undefined {
  return embargoes
    .filter((embargo): embargo is string => !!embargo)
    .reduce<string | undefined>(
      (latest, embargo) => (!latest || new Date(embargo).getTime() > new Date(latest).getTime() ? embargo : latest),
      undefined,
    );
}

function getMaxRoundNumber(structure: any): number {
  const matchUps = structure?.matchUps || [];
  return matchUps.reduce((max: number, m: any) => Math.max(max, m.roundNumber || 0), 0);
}

function buildRoundRows({ event, dd, structureId, sd }): PublishingRowData[] {
  const roundRows: PublishingRowData[] = [];

  // Round rows hidden by roundLimit
  if (sd?.roundLimit != null) {
    const structure = dd.structures?.find((s: any) => s.structureId === structureId);
    const maxRound = getMaxRoundNumber(structure);
    for (let rn = sd.roundLimit + 1; rn <= maxRound; rn++) {
      roundRows.push({
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
    if (publishingGovernor.isEmbargoed(rd)) {
      roundRows.push({
        id: `${dd.drawId}:${structureId}:sched${rn}`,
        name: `${t(PUB_ROUND_KEY)} ${rn} ${t('publishing.roundSchedule').toLowerCase()}`,
        type: 'round',
        eventId: event.eventId,
        drawId: dd.drawId,
        structureId,
        roundNumber: Number(rn),
        scheduleEmbargo: rd.embargo,
        scheduleEmbargoActive: true,
        published: true,
        embargo: undefined,
        embargoActive: false,
        publishState: 'embargoed',
      });
    }
  }

  return roundRows;
}

function buildStructureRows({ event, dd, drawRow, structureDetails }): PublishingRowData[] {
  const drawEmbargo = drawRow.embargo;
  return (dd.structures || []).map((structure: any) => {
    const { structureId } = structure;
    const sd = structureDetails[structureId];
    const published = drawRow.published && isStructurePublished(structureDetails, structureId);
    const roundRows = buildRoundRows({ event, dd, structureId, sd });
    return {
      id: `${dd.drawId}:${structureId}`,
      name: structure.structureName || structure.stage || structureId,
      type: 'structure' as const,
      eventId: event.eventId,
      drawId: dd.drawId,
      structureId,
      published,
      embargo: sd?.embargo,
      embargoActive: publishingGovernor.isEmbargoed(sd),
      publishState: resolvePublishState(published, latestEmbargo(drawEmbargo, sd?.embargo)),
      expanded: roundRows.length > 0,
      _children: roundRows.length ? roundRows : undefined,
    };
  });
}

function buildDrawRow({ event, dd, drawDetails, eventPublished }): PublishingRowData {
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
    embargoActive: publishingGovernor.isEmbargoed(detail),
    publishState: resolvePublishState(published, embargo),
  };

  const structureDetails = drawDetails[dd.drawId]?.structureDetails || {};

  // A draw with several structures (qualifying, main, consolation, playoffs) lists them so each can be
  // published or embargoed on its own. A single-structure draw keeps its round rows directly beneath it.
  if ((dd.structures?.length ?? 0) > 1) {
    const structureRows = buildStructureRows({ event, dd, drawRow, structureDetails });
    drawRow._children = structureRows;
    // Collapsed by default; open when the draw is already published selectively, so that state shows.
    drawRow.expanded = structureRows.some((row) => row.published !== drawRow.published || row.embargo || row.expanded);
  } else {
    const roundChildren = Object.entries(structureDetails).flatMap(([structureId, sd]) =>
      buildRoundRows({ event, dd, structureId, sd }),
    );
    if (roundChildren.length) {
      drawRow._children = roundChildren;
      drawRow.expanded = true;
    }
  }

  return drawRow;
}

export function getPublishingTableData(): PublishingRowData[] {
  const events = tournamentEngine.q.events() || [];
  const rows: PublishingRowData[] = [];

  for (const event of events) {
    const eventPubState = publishingGovernor.getPublishState({ event })?.publishState;
    const drawDetails = eventPubState?.status?.drawDetails || {};
    const eventPublished = !!eventPubState?.status?.published;
    const drawDefinitions = event.drawDefinitions || [];

    const children: PublishingRowData[] = drawDefinitions.map((dd: any) =>
      buildDrawRow({ event, dd, drawDetails, eventPublished }),
    );

    rows.push({
      id: event.eventId ?? '',
      name: event.eventName ?? '',
      type: 'event',
      eventId: event.eventId,
      published: eventPublished,
      embargo: undefined,
      embargoActive: false,
      publishState: eventPublished ? 'live' : 'off',
      expanded: true,
      _children: children.length ? children : undefined,
    });
  }

  return rows;
}

export function getActiveEmbargoes(): EmbargoEntry[] {
  const embargoes: EmbargoEntry[] = [];
  const publishState = tournamentEngine.q.publishState();
  const tournamentPubState = publishState?.tournament;

  if (tournamentPubState?.orderOfPlay?.embargo) {
    const embargo = tournamentPubState.orderOfPlay.embargo;
    embargoes.push({
      type: 'orderOfPlay',
      label: t('publishing.orderOfPlay'),
      embargo,
      embargoActive: publishingGovernor.isEmbargoed(tournamentPubState.orderOfPlay),
    });
  }

  if (tournamentPubState?.participants?.embargo) {
    const embargo = tournamentPubState.participants.embargo;
    embargoes.push({
      type: 'participants',
      label: t('publishing.participants'),
      embargo,
      embargoActive: publishingGovernor.isEmbargoed(tournamentPubState.participants),
    });
  }

  const events = tournamentEngine.q.events() || [];
  for (const event of events) {
    const eventPubState = publishingGovernor.getPublishState({ event })?.publishState;
    const drawDetails = eventPubState?.status?.drawDetails || {};

    for (const [drawId, details] of Object.entries(drawDetails) as [string, any][]) {
      const detail = details?.publishingDetail;
      if (detail?.embargo) {
        const embargoActive = publishingGovernor.isEmbargoed(detail);
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

      // Structure embargoes and round-level schedule embargoes from structureDetails
      const structureDetails = details?.structureDetails || {};
      for (const [structureId, sd] of Object.entries(structureDetails) as [string, any][]) {
        if (sd?.embargo) {
          const drawDef = event.drawDefinitions?.find((dd: any) => dd.drawId === drawId);
          const structure = drawDef?.structures?.find((s: any) => s.structureId === structureId);
          embargoes.push({
            type: 'structure',
            label: `${event.eventName} — ${drawDef?.drawName || drawId} — ${structure?.structureName || structureId}`,
            embargo: sd.embargo,
            embargoActive: publishingGovernor.isEmbargoed(sd),
            eventId: event.eventId,
            drawId,
            structureId,
          });
        }

        const scheduledRounds = sd?.scheduledRounds || {};
        for (const [roundNumber, rd] of Object.entries(scheduledRounds) as [string, any][]) {
          if (rd?.embargo) {
            const embargoActive = publishingGovernor.isEmbargoed(rd);
            const drawDef = event.drawDefinitions?.find((dd: any) => dd.drawId === drawId);
            embargoes.push({
              type: 'scheduledRound',
              label: `${event.eventName} — ${drawDef?.drawName || drawId} — ${t(PUB_ROUND_KEY)} ${roundNumber} ${t('publishing.roundSchedule').toLowerCase()}`,
              embargo: rd.embargo,
              embargoActive,
              eventId: event.eventId,
              drawId,
              structureId,
              roundNumber,
            });
          }
        }
      }
    }
  }

  embargoes.sort((a, b) => new Date(a.embargo).getTime() - new Date(b.embargo).getTime());
  return embargoes;
}
