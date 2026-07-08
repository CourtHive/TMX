/**
 * Order-of-play publish state + per-date toggle logic.
 *
 * One home for "is this date's order of play published?" and "what mutation
 * toggles it?", shared by the schedule page (date selector cue + footer
 * publish control) and the publishing tab's per-date chips so the two cannot
 * drift (they previously each inlined the `allDatesPublished` rule).
 *
 * DOM-free and engine-injectable so the toggle logic is unit-testable in the
 * node vitest env.
 */
import { PUBLISH_ORDER_OF_PLAY, UNPUBLISH_ORDER_OF_PLAY } from 'constants/mutationConstants';
import { tournamentEngine } from 'services/factory/engine';

export interface OrderOfPlayPublishState {
  /** Order of play is published at all. */
  published: boolean;
  /** Published with an empty `scheduledDates` list → every date is public. */
  allPublished: boolean;
  /** Explicitly-published dates (empty when `allPublished`). */
  publishedDates: string[];
}

/** Read the tournament's order-of-play publish status from the engine. */
export function getOrderOfPlayPublishState(): OrderOfPlayPublishState {
  const publishState: any = tournamentEngine.q?.publishState?.() ?? {};
  const oop = publishState?.tournament?.orderOfPlay;
  const published = !!oop?.published;
  const scheduledDates: string[] = Array.isArray(oop?.scheduledDates) ? oop.scheduledDates : [];
  return { published, allPublished: published && scheduledDates.length === 0, publishedDates: scheduledDates };
}

/** Whether a specific date's order of play is published. */
export function isOrderOfPlayDatePublished(date: string, state: OrderOfPlayPublishState): boolean {
  if (!state.published) return false;
  return state.allPublished || state.publishedDates.includes(date);
}

/**
 * Mutation methods that toggle publication of a single order-of-play date,
 * mirroring the publishing tab's per-date chip logic. `dateRange` materializes
 * the full published set when the tournament is currently "all dates published"
 * (empty `scheduledDates`) so removing one date keeps the others public.
 * Returns `willPublish` so callers can phrase a confirmation dialog.
 */
export function buildOrderOfPlayDateToggleMethods(
  date: string,
  dateRange: string[],
  state: OrderOfPlayPublishState,
): { methods: { method: string; params?: any }[]; willPublish: boolean } {
  const currentlyPublished = isOrderOfPlayDatePublished(date, state);
  const effectiveDates = state.allPublished ? [...dateRange] : [...state.publishedDates];
  const newDates = currentlyPublished
    ? effectiveDates.filter((d) => d !== date)
    : [...new Set([...effectiveDates, date])];

  const methods = newDates.length
    ? [{ method: PUBLISH_ORDER_OF_PLAY, params: { scheduledDates: newDates, removePriorValues: true } }]
    : [{ method: UNPUBLISH_ORDER_OF_PLAY }];

  return { methods, willPublish: !currentlyPublished };
}
