/**
 * Promote alternates — the pure part: who the alternates are, in promotion order, how many places are open
 * among the accepted entries, and the default and bounds of the count the TD chooses.
 *
 * Open places = the event's entry limit minus its accepted MAIN entries. The limit is the event's
 * `entryProfile.entriesLimit` (how many entries it accepts), else `entryProfile.targetDrawSize` (the intended
 * draw size before a draw exists). Accepted = the factory's STRUCTURE_SELECTED_STATUSES, the same set the
 * entries table counts as Accepted; WITHDRAWN is not among them, so a withdrawal frees a place. With no limit
 * there is nothing to count against: no open-places figure, and the default is 1.
 */
import { drawDefinitionConstants, entryStatusConstants } from 'tods-competition-factory';
import { acceptedStatusSet } from 'constants/acceptedEntryStatuses';

// constants
import { PROMOTE_ALTERNATES } from 'constants/mutationConstants';

const { ALTERNATE } = entryStatusConstants;
const { MAIN } = drawDefinitionConstants;

export type PromotionLimitSource = 'entriesLimit' | 'targetDrawSize';

export type PromotionPlan = {
  /** MAIN alternates' participantIds in promotion order */
  alternateIds: string[];
  acceptedCount: number;
  limit?: number;
  limitSource?: PromotionLimitSource;
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

function getEntryLimit(event: any): { limit?: number; limitSource?: PromotionLimitSource } {
  const { entriesLimit, targetDrawSize } = event?.entryProfile ?? {};
  if (Number.isSafeInteger(entriesLimit) && entriesLimit > 0)
    return { limit: entriesLimit, limitSource: 'entriesLimit' };
  if (Number.isSafeInteger(targetDrawSize) && targetDrawSize > 0)
    return { limit: targetDrawSize, limitSource: 'targetDrawSize' };
  return {};
}

export function getPromotionPlan({ event }: { event: any }): PromotionPlan {
  const entries = event?.entries ?? [];
  const alternateIds = orderedAlternateIds(entries);
  const acceptedCount = entries.filter(
    (entry: any) => stageOf(entry) === MAIN && acceptedStatusSet.has(entry.entryStatus),
  ).length;
  const { limit, limitSource } = getEntryLimit(event);
  const openSlots = limit === undefined ? undefined : Math.max(0, limit - acceptedCount);

  const max = alternateIds.length;
  const min = max ? 1 : 0;
  const defaultCount = clampPromoteCount(openSlots ?? 1, { min, max });

  return { alternateIds, acceptedCount, limit, limitSource, openSlots, defaultCount, min, max };
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
