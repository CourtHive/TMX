/**
 * Schedule2 — engine-backed matchUp timing, resolved once per render pass.
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
import type { RestTiming } from './participantRest';

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

/**
 * A timing lookup valid for one render pass. Satisfies both `ReadinessTiming`
 * and `RestTiming` structurally, so readiness and rest share one resolver and
 * cannot drift apart on what a format costs.
 */
export function makeTimingResolver(): (matchUp: ReadinessMatchUp) => RestTiming {
  const cache = new Map<string, RestTiming>();
  const events = buildEventMap();

  return (matchUp: ReadinessMatchUp) => {
    const matchUpFormat = matchUp.matchUpFormat ?? '';
    const eventId = matchUp.eventId ?? '';
    const key = `${matchUpFormat}|${matchUp.matchUpType ?? ''}|${eventId}`;
    const cached = cache.get(key);
    if (cached) return cached;

    let timing = FALLBACK_TIMING;
    if (matchUpFormat) {
      // `matchUpType` is a plain string on the hydrated matchUp but an
      // `EventTypeUnion` on the engine signature; the engine validates it and
      // falls back to SINGLES, so widen at the boundary rather than duplicating
      // the union here.
      const event = events.get(eventId);
      const result: any = tournamentEngine.getMatchUpFormatTiming({
        eventType: matchUp.matchUpType as any,
        ...categoryOf(event),
        matchUpFormat,
        event,
      });
      if (!result?.error) {
        timing = {
          averageMinutes: result?.averageMinutes ?? FALLBACK_TIMING.averageMinutes,
          recoveryMinutes: result?.recoveryMinutes ?? FALLBACK_TIMING.recoveryMinutes,
          typeChangeRecoveryMinutes: result?.typeChangeRecoveryMinutes ?? 0,
        };
      }
    }
    cache.set(key, timing);
    return timing;
  };
}
