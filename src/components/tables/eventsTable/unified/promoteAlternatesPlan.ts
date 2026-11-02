/**
 * Promote alternates — the pure part: who the alternates are, in promotion order, how many places are open
 * among the accepted entries, and the default and bounds of the count the TD chooses.
 *
 * Open places come from the factory's `getEventEntrySpace`: the MAIN draw positions (the generated structure,
 * else `entryProfile.targetDrawSize`, else the sanctioned draw size) less the places held for qualifiers and
 * wildcards, less the entries accepted directly. A withdrawal frees a place.
 *
 * When that query states no draw size, the event's `entryProfile.entriesLimit` (how many entries it accepts)
 * is the limit, counted against STRUCTURE_SELECTED_STATUSES, the same set the entries table counts as
 * Accepted — the query deliberately leaves `entriesLimit` out, since it need not equal the draw's places. With
 * neither there is nothing to count against: no open-places figure, and the default is 1.
 */
import { drawDefinitionConstants, entryStatusConstants } from 'tods-competition-factory';
import { acceptedStatusSet } from 'constants/acceptedEntryStatuses';
import { tournamentEngine } from 'services/factory/engine';

// constants
import { PROMOTE_ALTERNATES } from 'constants/mutationConstants';

const { ALTERNATE } = entryStatusConstants;
const { MAIN } = drawDefinitionConstants;

export type PromotionLimitSource = 'entriesLimit' | 'targetDrawSize' | 'drawPositions' | 'sanctionedDrawSize';

/** what `getEventEntrySpace` returns, as far as the plan reads it */
export type EntrySpace = {
  basis: 'STRUCTURE' | 'TARGET_DRAW_SIZE' | 'SANCTIONING_CONSTRAINTS' | 'NONE';
  drawPositions: number;
  qualifierPositions: number;
  wildcardPositions: number;
  directAcceptedCount: number;
  directAcceptancePlaces?: number;
  openPlaces?: number;
};

const LIMIT_SOURCE: Record<string, PromotionLimitSource> = {
  STRUCTURE: 'drawPositions',
  TARGET_DRAW_SIZE: 'targetDrawSize',
  SANCTIONING_CONSTRAINTS: 'sanctionedDrawSize',
};

export type PromotionPlan = {
  /** MAIN alternates' participantIds in promotion order */
  alternateIds: string[];
  acceptedCount: number;
  limit?: number;
  limitSource?: PromotionLimitSource;
  /** the draw positions and the places held back from them, when the limit came from getEventEntrySpace */
  drawPositions?: number;
  qualifierPositions?: number;
  wildcardPositions?: number;
  /** open places among the accepted entries; undefined when the event states no limit */
  openSlots?: number;
  defaultCount: number;
  min: number;
  max: number;
};

const stageOf = (entry: any) => entry.entryStage ?? MAIN;

function positionOf(entry: any): number | undefined {
  const value = entry?.entryPosition;
  if (value === undefined || value === null || value === '') return undefined;
  const position = Number(value);
  return Number.isFinite(position) ? position : undefined;
}

/**
 * The factory promotes the alternate with the lowest entryPosition first; alternates with no position follow
 * in the order they were entered.
 */
export function orderedAlternateIds(entries: any[] = []): string[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.entryStatus === ALTERNATE && stageOf(entry) === MAIN)
    .sort((a, b) => {
      const pa = positionOf(a.entry) ?? Infinity;
      const pb = positionOf(b.entry) ?? Infinity;
      return pa === pb ? a.index - b.index : pa - pb;
    })
    .map(({ entry }) => entry.participantId);
}

/** The factory's count of the event's direct-acceptance places; undefined when it cannot answer. */
export function getEntrySpace(event: any): EntrySpace | undefined {
  if (!event?.eventId) return undefined;
  const result: any = tournamentEngine.getEventEntrySpace({ eventId: event.eventId });
  return result?.success ? result : undefined;
}

type Limit = Pick<
  PromotionPlan,
  'limit' | 'limitSource' | 'openSlots' | 'drawPositions' | 'qualifierPositions' | 'wildcardPositions'
> & { acceptedCount?: number };

function getLimit(event: any, entrySpace?: EntrySpace): Limit {
  if (entrySpace && entrySpace.basis !== 'NONE' && entrySpace.openPlaces !== undefined) {
    return {
      limit: entrySpace.directAcceptancePlaces,
      limitSource: LIMIT_SOURCE[entrySpace.basis],
      openSlots: entrySpace.openPlaces,
      acceptedCount: entrySpace.directAcceptedCount,
      drawPositions: entrySpace.drawPositions,
      qualifierPositions: entrySpace.qualifierPositions,
      wildcardPositions: entrySpace.wildcardPositions,
    };
  }
  const { entriesLimit } = event?.entryProfile ?? {};
  if (Number.isSafeInteger(entriesLimit) && entriesLimit > 0)
    return { limit: entriesLimit, limitSource: 'entriesLimit' };
  return {};
}

/**
 * `entrySpace` is the event's `getEventEntrySpace` result; when it is not passed, the plan asks the engine for
 * it, so the event must be the engine's.
 */
export function getPromotionPlan({ event, entrySpace }: { event: any; entrySpace?: EntrySpace }): PromotionPlan {
  const entries = event?.entries ?? [];
  const alternateIds = orderedAlternateIds(entries);
  const { acceptedCount: directAcceptedCount, ...limit } = getLimit(event, entrySpace ?? getEntrySpace(event));
  const acceptedCount =
    directAcceptedCount ??
    entries.filter((entry: any) => stageOf(entry) === MAIN && acceptedStatusSet.has(entry.entryStatus)).length;
  const openSlots =
    limit.openSlots ?? (limit.limit === undefined ? undefined : Math.max(0, limit.limit - acceptedCount));

  const max = alternateIds.length;
  const min = max ? 1 : 0;
  const defaultCount = clampPromoteCount(openSlots ?? 1, { min, max });

  return { alternateIds, acceptedCount, ...limit, openSlots, defaultCount, min, max };
}

const SLOTS_KEY: Record<PromotionLimitSource, string> = {
  entriesLimit: 'entries.promoteAlternates.openSlotsEntriesLimit',
  targetDrawSize: 'entries.promoteAlternates.openSlotsTargetDrawSize',
  drawPositions: 'entries.promoteAlternates.openSlotsDrawPositions',
  sanctionedDrawSize: 'entries.promoteAlternates.openSlotsSanctionedDrawSize',
};

/** The i18n key and values that explain the open-places figure. */
export function openSlotsMessage(plan: PromotionPlan): { key: string; values?: Record<string, number | undefined> } {
  if (plan.openSlots === undefined || !plan.limitSource) return { key: 'entries.promoteAlternates.noLimit' };
  const values = { limit: plan.limit, accepted: plan.acceptedCount, open: plan.openSlots };
  if (plan.qualifierPositions || plan.wildcardPositions)
    return {
      key: 'entries.promoteAlternates.openSlotsHeld',
      values: {
        ...values,
        drawPositions: plan.drawPositions,
        qualifiers: plan.qualifierPositions ?? 0,
        wildcards: plan.wildcardPositions ?? 0,
      },
    };
  return { key: SLOTS_KEY[plan.limitSource], values };
}

/** Whole numbers within [min, max]; anything unreadable falls back to min. */
export function clampPromoteCount(value: unknown, { min, max }: { min: number; max: number }): number {
  const count = Math.floor(Number(value));
  if (!Number.isFinite(count)) return min;
  return Math.min(max, Math.max(min, count));
}

/** The alternates promoted for a chosen count, in order. */
export function alternatesToPromote(plan: PromotionPlan, count: unknown): string[] {
  return plan.alternateIds.slice(0, clampPromoteCount(count, plan));
}

export function buildPromoteAlternatesMethod({
  participantIds,
  eventId,
  drawId,
}: {
  participantIds: string[];
  eventId: string;
  drawId?: string;
}) {
  const params: Record<string, any> = { eventId, participantIds };
  if (drawId) params.drawId = drawId;
  return { method: PROMOTE_ALTERNATES, params };
}
