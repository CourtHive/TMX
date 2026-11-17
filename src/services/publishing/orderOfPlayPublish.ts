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
import { readPublishState } from 'services/factory/passReads';

export interface OrderOfPlayPublishState {
  /** Order of play is published at all. */
  published: boolean;
  /** Published with an empty `scheduledDates` list → every date is public. */
  allPublished: boolean;
  /** Explicitly-published dates (empty when `allPublished`). */
  publishedDates: string[];
  /** The whole-schedule embargo, which every republish must restate or it is lost. */
  embargo?: string;
  /** Per-date release times, `{ 'YYYY-MM-DD': ISO instant }`; the factory keeps them when a republish omits them. */
  dateEmbargoes?: Record<string, string>;
}

/** Read the tournament's order-of-play publish status from the engine. */
export function getOrderOfPlayPublishState(): OrderOfPlayPublishState {
  const publishState: any = readPublishState() ?? {};
  const oop = publishState?.tournament?.orderOfPlay;
  const published = !!oop?.published;
  const scheduledDates: string[] = Array.isArray(oop?.scheduledDates) ? oop.scheduledDates : [];
  return {
    published,
    allPublished: published && scheduledDates.length === 0,
    publishedDates: scheduledDates,
    embargo: oop?.embargo,
    dateEmbargoes: oop?.dateEmbargoes,
  };
}

/** A date's own release time, when it has one. */
export function getOrderOfPlayDateEmbargo(date: string, state: OrderOfPlayPublishState): string | undefined {
  return state.dateEmbargoes?.[date];
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

  // `publishOrderOfPlay` rebuilds the publish record from its params, so the whole-schedule embargo must be restated
  // here: omitting it released the schedule the moment any one date was toggled
  const methods = newDates.length
    ? [
        {
          method: PUBLISH_ORDER_OF_PLAY,
          params: { scheduledDates: newDates, ...embargoParam(state), removePriorValues: true },
        },
      ]
    : [{ method: UNPUBLISH_ORDER_OF_PLAY }];

  return { methods, willPublish: !currentlyPublished };
}

/**
 * Mutation methods that set (`embargo` given) or clear (`undefined`) one date's release time. Setting one publishes
 * the date if it is not yet published: a director who says "day 2 goes out at 18:00" means day 2 is published, and
 * withheld until then. Clearing leaves the date published, visible at once. The whole-schedule embargo and the
 * other dates' release times ride along unchanged.
 */
export function buildOrderOfPlayDateEmbargoMethods(
  date: string,
  embargo: string | undefined,
  state: OrderOfPlayPublishState,
): { method: string; params?: any }[] {
  // nothing is published, so there is no release time to clear
  if (!embargo && !state.published) return [];

  const dateEmbargoes = { ...(state.dateEmbargoes ?? {}) };
  if (embargo) dateEmbargoes[date] = embargo;
  else delete dateEmbargoes[date];

  const params: any = {
    ...embargoParam(state),
    dateEmbargoes: Object.keys(dateEmbargoes).length ? dateEmbargoes : null,
    removePriorValues: true,
  };
  // all dates published stays "all dates" (no list); otherwise the list must include this date
  if (!state.allPublished) {
    const publishedDates = state.published ? state.publishedDates : [];
    params.scheduledDates = embargo ? [...new Set([...publishedDates, date])] : publishedDates;
  }
  return [{ method: PUBLISH_ORDER_OF_PLAY, params }];
}

function embargoParam(state: OrderOfPlayPublishState): { embargo?: string } {
  return state.embargo ? { embargo: state.embargo } : {};
}
