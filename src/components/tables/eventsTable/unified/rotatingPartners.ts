/**
 * Rotating partners — pairing individuals who are already paired, in an AD_HOC doubles draw.
 *
 * AD_HOC entries are a roster, not a field, so the factory lets PAIRs share an individual there (and
 * nowhere else); it keeps one person out of two matchUps of the same round itself. What TMX lacked was
 * a way to create such a pair: an individual who is already paired is not an entry, so they never
 * appeared in the table to be selected.
 *
 * In "Rotating partners" mode the draw-entries view therefore shows each individual of the draw's PAIR
 * entries as a *virtual* [Grouped] row. It is never an entry — an individual in an entered PAIR cannot
 * also be an UNGROUPED entry (the factory evicts one) — and it supports pairing only. The event's
 * UNGROUPED individuals who are not yet in the draw are shown too, so they can be paired into it.
 *
 * Every decision lives here, away from the DOM, so it is unit-testable (TMX has no DOM test layer).
 */
import {
  drawDefinitionConstants,
  entryStatusConstants,
  eventConstants,
  participantConstants,
} from 'tods-competition-factory';

// constants
import { ADD_DRAW_ENTRIES, ADD_EVENT_ENTRY_PAIRS } from 'constants/mutationConstants';

const { ALTERNATE, UNGROUPED, WITHDRAWN } = entryStatusConstants;
const { AD_HOC, MAIN } = drawDefinitionConstants;
const { PAIR } = participantConstants;
const { DOUBLES } = eventConstants;

export const UNGROUPED_RANK = 3;
/** Sorts after Withdrawn (4), which the draw-entries view hides, so it reads as directly after Ungrouped. */
export const GROUPED_RANK = 5;

const PAIRABLE_RANKS = new Set([UNGROUPED_RANK, GROUPED_RANK]);

type Entry = { participantId: string; entryStatus?: string; entryStage?: string };
type Participant = { participantId: string; participantType?: string; individualParticipantIds?: string[] };

/**
 * Only an AD_HOC draw (DrawMatic is stored as AD_HOC) in a doubles event. SWISS is excluded on purpose:
 * the factory refuses a Swiss round over entrants that share an individual.
 */
export function isRotatingPartnersEligible({ event, drawDefinition }: { event?: any; drawDefinition?: any }): boolean {
  return event?.eventType === DOUBLES && drawDefinition?.drawType === AD_HOC;
}

/** participantId -> individualParticipantIds, for the PAIR participants among `participants`. */
export function getPairIndividualsMap(participants: Participant[] = []): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const participant of participants) {
    if (participant.participantType === PAIR && participant.individualParticipantIds?.length) {
      map[participant.participantId] = participant.individualParticipantIds;
    }
  }
  return map;
}

const isActivePairEntry = (entry: Entry, pairIndividuals: Record<string, string[]>) =>
  entry.entryStatus !== WITHDRAWN && !!pairIndividuals[entry.participantId];

/**
 * The mode starts ON when the draw already holds PAIRs sharing an individual: the draw's own data is
 * the memory of the mode having been used, so nothing needs to be persisted.
 */
export function drawHasSharedIndividuals({
  drawEntries = [],
  pairIndividuals,
}: {
  drawEntries?: Entry[];
  pairIndividuals: Record<string, string[]>;
}): boolean {
  const seen = new Set<string>();
  for (const entry of drawEntries) {
    if (!isActivePairEntry(entry, pairIndividuals)) continue;
    for (const individualId of pairIndividuals[entry.participantId]) {
      if (seen.has(individualId)) return true;
      seen.add(individualId);
    }
  }
  return false;
}

export type GroupedIndividual = {
  individualId: string;
  /** PAIR participantIds (draw entries) this individual belongs to */
  pairIds: string[];
  /** entryStage of the first PAIR entry, so an Accepted pairing inherits the stage its members occupy */
  entryStage?: string;
};

/** Each individual of the draw's non-withdrawn PAIR entries, once, with the pairs they are in. */
export function getGroupedIndividuals({
  drawEntries = [],
  pairIndividuals,
}: {
  drawEntries?: Entry[];
  pairIndividuals: Record<string, string[]>;
}): GroupedIndividual[] {
  const byId = new Map<string, GroupedIndividual>();
  for (const entry of drawEntries) {
    if (!isActivePairEntry(entry, pairIndividuals)) continue;
    for (const individualId of pairIndividuals[entry.participantId]) {
      const grouped = byId.get(individualId) ?? { individualId, pairIds: [], entryStage: entry.entryStage };
      grouped.pairIds.push(entry.participantId);
      byId.set(individualId, grouped);
    }
  }
  return [...byId.values()];
}

/** The event's UNGROUPED individuals who are not (yet) entries of the draw. */
export function getEventOnlyUngroupedEntries({
  eventEntries = [],
  drawEntries = [],
}: {
  eventEntries?: Entry[];
  drawEntries?: Entry[];
}): Entry[] {
  const inDraw = new Set(drawEntries.map((entry) => entry.participantId));
  return eventEntries.filter((entry) => entry.entryStatus === UNGROUPED && !inDraw.has(entry.participantId));
}

/** Whether two individuals already form a PAIR entered in the event, in any status. */
export function areEventPartners({
  individualIds,
  eventEntries = [],
  pairIndividuals,
}: {
  individualIds: string[];
  eventEntries?: Entry[];
  pairIndividuals: Record<string, string[]>;
}): boolean {
  const [a, b] = individualIds;
  return eventEntries.some((entry) => {
    const individuals = pairIndividuals[entry.participantId];
    return !!individuals && individuals.includes(a) && individuals.includes(b);
  });
}

export type PairabilityReason = 'NOT_TWO' | 'NOT_PAIRABLE' | 'SAME_PERSON' | 'ALREADY_PARTNERS';

/**
 * Whether the selected rows can be paired. Without the mode only two Ungrouped rows can; with it, any
 * two of Ungrouped/Grouped — but never two individuals who are already partners in the event
 * (`pairFromUnified` allows duplicate participant pairs, so the factory would not stop it).
 */
export function getPairability({
  rows,
  rotatingEnabled,
  eventEntries,
  pairIndividuals,
}: {
  rows: any[];
  rotatingEnabled: boolean;
  eventEntries?: Entry[];
  pairIndividuals: Record<string, string[]>;
}): { pairable: boolean; reason?: PairabilityReason } {
  const selected = rows.filter((row) => !row?._isSeparator);
  if (selected.length !== 2) return { pairable: false, reason: 'NOT_TWO' };

  const ranks = rotatingEnabled ? PAIRABLE_RANKS : new Set([UNGROUPED_RANK]);
  if (!selected.every((row) => ranks.has(row._segmentRank))) return { pairable: false, reason: 'NOT_PAIRABLE' };

  const individualIds = selected.map((row) => row.participantId);
  if (individualIds[0] === individualIds[1]) return { pairable: false, reason: 'SAME_PERSON' };

  if (areEventPartners({ individualIds, eventEntries, pairIndividuals })) {
    return { pairable: false, reason: 'ALREADY_PARTNERS' };
  }

  return { pairable: true };
}

/**
 * Rows that are not draw entries — virtual Grouped rows and event-only Ungrouped rows. Every action other
 * than pairing operates on draw entries, so it must not be offered for a selection containing one.
 */
export function selectionHasNonDrawEntries(rows: any[]): boolean {
  return rows.some((row) => row?._grouped || row?._eventOnly);
}

/** A new pair overlaps existing entries exactly when one of its members is already grouped. */
export function pairOverlapsEntries(rows: any[]): boolean {
  return rows.some((row) => row?._grouped);
}

/**
 * The mutation plan for a new pair.
 *
 * A pair that shares an individual with existing entries enters the **event** as ALTERNATE and the
 * **draw** as the chosen status. The event's accepted entries are what a bracketed flight is generated
 * from, and the factory refuses a bracketed draw whose entries share an individual; an ALTERNATE is a
 * waiting list and exempt. The AD_HOC draw, whose entries are a roster, gets the pair as chosen.
 *
 * A pair overlapping nothing is added exactly as before: one call that enters event and draw together.
 */
export function buildPairMethods({
  participantIds,
  pairParticipantId,
  entryStatus,
  entryStage,
  overlaps,
  eventId,
  drawId,
}: {
  participantIds: [string, string];
  pairParticipantId: string;
  entryStatus: string;
  entryStage: string;
  overlaps: boolean;
  eventId: string;
  drawId?: string;
}): any[] {
  const pairParams = {
    participantIdPairs: [participantIds],
    allowDuplicateParticipantIdPairs: true,
    uuids: [pairParticipantId],
    eventId,
  };

  if (!overlaps || !drawId) {
    return [{ method: ADD_EVENT_ENTRY_PAIRS, params: { ...pairParams, entryStatus, entryStage, drawId } }];
  }

  return [
    { method: ADD_EVENT_ENTRY_PAIRS, params: { ...pairParams, entryStatus: ALTERNATE, entryStage: MAIN } },
    {
      method: ADD_DRAW_ENTRIES,
      params: {
        participantIds: [pairParticipantId],
        ignoreStageSpace: true,
        entryStatus,
        entryStage,
        eventId,
        drawId,
      },
    },
  ];
}
