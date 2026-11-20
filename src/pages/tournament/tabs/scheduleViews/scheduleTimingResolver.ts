/**
 * Schedule2 — engine-backed matchUp timing, resolved once per render pass.
 *
 * Used by the Inspector's Timing section, which DISPLAYS the figures. Readiness and rest are the
 * factory's queries now and resolve timing themselves; measured 2026-10-07 on a 307-matchUp
 * production record, this resolver and the factory's agree on every matchUp.
 *
 * `getMatchUpFormatTiming` is what the auto-scheduler itself resolves against,
 * including its scheduling-policy fallback, so unpoliced tournaments still get
 * per-format averages rather than a flat 90/0.
 *
 * ── Why the category is passed explicitly AND the event is passed ──
 *
 * Recovery is category-dependent. `POLICY_SCHEDULING_DEFAULT` gives ADULT and
 * WHEELCHAIR doubles 30 minutes but JUNIOR doubles 60. Passing only
 * `{ matchUpFormat, eventType }` — as the Inspector's readiness section did
 * until this module existed — silently resolved junior doubles to the adult
 * figure.
 *
 * Passing `event` alone does NOT fix it, and that is a factory bug rather than
 * a preference. `getScheduleTiming` resolves `categoryType` off
 * `event.category` correctly, but `getMatchUpFormatTiming` then rebuilds its
 * `timingDetails` as `{ ...scheduleTiming, …, categoryType, … }`
 * (`getMatchUpFormatTiming.ts:90-96`) where `categoryType` is the *parameter* —
 * `undefined` when the caller supplied only an event. The explicit key clobbers
 * the resolved one, so the event's category is discarded. Measured against
 * factory 6.29.1 with a JUNIOR DOUBLES `SET3-S:6/TB7` event: `{ event }` → 30,
 * `{ categoryType: 'JUNIOR' }` → 60, bare → 30.
 *
 * So the category is resolved here and passed explicitly, which works today
 * against the published factory. The `event` is passed as well, because it is
 * the only way to reach event-level scheduling policies and the event's
 * `SCHEDULE_TIMING` extension — and because this call site should keep working
 * unchanged once the factory clobber is fixed.
 *
 * Memoised per `matchUpFormat|matchUpType|eventId` for the life of one render
 * pass — a tournament has a handful of distinct combinations, not one per
 * matchUp.
 */

import { tournamentEngine } from 'services/factory/engine';

// constants and types
import type { ReadinessMatchUp } from './matchUpReadiness';

/** A matchUp's format timing, as the factory resolves it. */
export interface RestTiming {
  averageMinutes: number;
  recoveryMinutes: number;
  /** Recovery required when the participant changes matchUpType (singles ↔ doubles). */
  typeChangeRecoveryMinutes?: number;
}

/** Used when a matchUp carries no format at all — keeps the arithmetic running rather than dropping findings. */
export const FALLBACK_TIMING: RestTiming = { averageMinutes: 90, recoveryMinutes: 0, typeChangeRecoveryMinutes: 0 };

/** `eventId` → event, for category and event-level policy resolution. */
function buildEventMap(): Map<string, any> {
  const { tournamentRecord }: any = tournamentEngine.getTournament() ?? {};
  return new Map((tournamentRecord?.events ?? []).map((event: any) => [event.eventId, event]));
}

/** The category identifiers the scheduling policy matches on, read the way `getScheduleTiming` reads them. */
function categoryOf(event: any): { categoryName?: string; categoryType?: string } {
  const category = event?.category;
  return {
    categoryName: category?.categoryName ?? category?.ageCategoryCode,
    categoryType: category?.categoryType ?? category?.subType,
  };
}

/** The factory's timing for one matchUp's format; undefined when the matchUp has no format or the lookup fails. */
function resolveFormatTiming(matchUp: ReadinessMatchUp, events: Map<string, any>): RestTiming | undefined {
  const matchUpFormat = matchUp.matchUpFormat;
  if (!matchUpFormat) return undefined;

  // `matchUpType` is a plain string on the hydrated matchUp but an
  // `EventTypeUnion` on the engine signature; the engine validates it and
  // falls back to SINGLES, so widen at the boundary rather than duplicating
  // the union here.
  const event = events.get(matchUp.eventId ?? '');
  const result: any = tournamentEngine.getMatchUpFormatTiming({
    eventType: matchUp.matchUpType as any,
    ...categoryOf(event),
    matchUpFormat,
    event,
  });
  if (result?.error) return undefined;
  return {
    averageMinutes: result?.averageMinutes ?? FALLBACK_TIMING.averageMinutes,
    recoveryMinutes: result?.recoveryMinutes ?? FALLBACK_TIMING.recoveryMinutes,
    typeChangeRecoveryMinutes: result?.typeChangeRecoveryMinutes ?? 0,
  };
}

/** Memoised per `matchUpFormat|matchUpType|eventId` for one render pass; `undefined` results are cached too. */
function memoiseTiming(): (matchUp: ReadinessMatchUp) => RestTiming | undefined {
  const cache = new Map<string, RestTiming | undefined>();
  const events = buildEventMap();

  return (matchUp: ReadinessMatchUp) => {
    const key = `${matchUp.matchUpFormat ?? ''}|${matchUp.matchUpType ?? ''}|${matchUp.eventId ?? ''}`;
    if (!cache.has(key)) cache.set(key, resolveFormatTiming(matchUp, events));
    return cache.get(key);
  };
}

/**
 * A timing lookup valid for one render pass. Satisfies both `ReadinessTiming`
 * and `RestTiming` structurally, so readiness and rest share one resolver and
 * cannot drift apart on what a format costs.
 */
export function makeTimingResolver(): (matchUp: ReadinessMatchUp) => RestTiming {
  const resolve = memoiseTiming();
  return (matchUp: ReadinessMatchUp) => resolve(matchUp) ?? FALLBACK_TIMING;
}

/**
 * A matchUp's average minutes, or undefined when it has none to give: no format, or a lookup that failed.
 * For totals that must not count a figure nobody set, where `makeTimingResolver` would supply a flat 90.
 */
export function makeAverageMinutesResolver(): (matchUp: ReadinessMatchUp) => number | undefined {
  const resolve = memoiseTiming();
  return (matchUp: ReadinessMatchUp) => resolve(matchUp)?.averageMinutes;
}
