/**
 * Schedule2 — participant rest analysis (pure, DOM-free, engine-free, clock-free).
 *
 * Answers the question a tournament director actually asks before calling a
 * match to court: *for each individual in this matchUp, how long have they
 * actually had off, and is that enough?*
 *
 * Deliberately NOT the same question as `matchUpReadiness.ts`. Readiness asks
 * "can this placement happen at the time it is scheduled for", so it is anchored
 * on the target's `scheduledTime` and skips entirely when there isn't one. Rest
 * is anchored on **now**, so it answers for a matchUp still sitting in the
 * catalog — which is exactly the moment the director is deciding whether to drag
 * it onto the Now strip.
 *
 * ── Time representation: read this before changing anything ──
 *
 * This module handles NO time conversion. Every instant reaches it as
 * `minutes since midnight of the day being viewed`, via the injected `timesFor`
 * callback. That is not squeamishness — the underlying values are in three
 * different frames:
 *
 *   - `endTime` / `startTime`  bare `HH:MM`, venue-local wall clock
 *   - `calledAt` / `scoredTime` full ISO instants, UTC
 *   - "now"                     the operator's browser clock
 *
 * Mixing those without an explicit conversion yields a rest figure wrong by the
 * UTC offset, which is worse than showing nothing. Isolating the conversion in
 * ONE named function in the adapter also means the planned Temporal-spec
 * standardization has a single site to change rather than a scatter of
 * `new Date()` calls.
 *
 * ── The precedence ladder ──
 *
 * "When did this participant's previous match end" has five answers of
 * decreasing fidelity. Every row reports which one it used, so an inferred
 * number never reads as a measured one:
 *
 *   1. `endTime`       operator recorded the actual finish        — measured
 *   2. `scoredTime`    when the score was entered                 — proxy
 *   3. `startTime`     + averageMinutes, match started            — projected
 *   4. `calledAt`      + averageMinutes, called to court          — projected
 *   5. `scheduledTime` + averageMinutes, plan only                — planned
 *
 * Rung 2 is the common path, not the exception: TMX writes `END_TIME` only on an
 * explicit operator action, while the factory auto-captures `scoredTime` on
 * every first score. A late-entered score pushes `scoredTime` *after* the true
 * finish, so rest is understated — the conservative direction, since it holds a
 * rested player back rather than calling a tired one.
 *
 * `RestInput` → `RestResult` is the seam, matching `matchUpReadiness.ts`: a
 * future factory `getParticipantRest` replaces this body and keeps the contract.
 * The factory is pure and has no clock, so it would take the same injected
 * `asOfMinutes` — the `calledAt` idiom of a caller-supplied wall clock.
 */

import { individualIds, isFinished, matchUpLabel, minutesToClock, nameFor } from './matchUpReadiness';

// constants and types
import type { ReadinessMatchUp } from './matchUpReadiness';

/** Which rung of the ladder produced a participant's rest anchor. */
export type RestSourceKind = 'endTime' | 'scoredTime' | 'startTime' | 'calledAt' | 'scheduledTime';

/** How much of the required recovery a participant has actually had. */
export type RestStatus = 'onCourt' | 'resting' | 'rested' | 'none';

/** True only for the rung the operator recorded directly; everything else is inferred. */
export const MEASURED_SOURCE: RestSourceKind = 'endTime';

/**
 * One matchUp's times, already normalized to minutes from midnight of the day
 * being viewed. Values may exceed 1440 (finished after midnight) or go negative
 * (started the previous day); the caller owns that arithmetic.
 */
export interface NormalizedTimes {
  endMinutes?: number;
  scoredMinutes?: number;
  startMinutes?: number;
  calledMinutes?: number;
  scheduledMinutes?: number;
}

export interface RestTiming {
  averageMinutes: number;
  recoveryMinutes: number;
  /** Recovery required when the participant changes matchUpType (singles ↔ doubles). */
  typeChangeRecoveryMinutes?: number;
}

/** Daily match limits, as the factory reports them. Any subset may be absent. */
export interface RestDailyLimits {
  SINGLES?: number;
  DOUBLES?: number;
  total?: number;
}

export interface RestInput {
  /** The matchUp being inspected. Need not be scheduled. */
  matchUpId: string;
  /** Every matchUp in the tournament, hydrated `{ inContext: true, nextMatchUps: true }`. */
  matchUps: ReadinessMatchUp[];
  /** The calendar day being viewed, `YYYY-MM-DD`. Rest is scoped to this day. */
  scheduledDate: string;
  /** "Now", as minutes from midnight of `scheduledDate`. */
  asOfMinutes: number;
  /** Engine-backed timing resolution. Returning zeroes disables the arithmetic without breaking it. */
  timingFor: (matchUp: ReadinessMatchUp) => RestTiming;
  /** Engine-backed time normalization. See the time-representation note above. */
  timesFor: (matchUp: ReadinessMatchUp) => NormalizedTimes;
  /** Tournament daily limits. Absent when no scheduling policy is attached — do NOT substitute a default. */
  dailyLimits?: RestDailyLimits;
}

/** How many matches a participant has already begun today, and against which limits. */
export interface RestDailyLoad {
  singles: number;
  doubles: number;
  total: number;
  /** Position the inspected matchUp would take, e.g. `3` for "3rd match today". */
  ordinal: number;
  /** Limits this matchUp would meet or exceed. Empty when no limits are configured. */
  atLimit: ('singles' | 'doubles' | 'total')[];
  /** The limit figure the ordinal should be read against, when one applies. */
  limit?: number;
}

export interface RestRow {
  participantId: string;
  participantName: string;
  status: RestStatus;
  /** Minutes rested so far. Absent for `onCourt` and `none`. */
  restMinutes?: number;
  /** Recovery this participant owes before the inspected matchUp. */
  requiredMinutes: number;
  /** True when `requiredMinutes` came from the singles ↔ doubles figure. */
  typeChange: boolean;
  /** Clock time the requirement is met, `HH:MM`. Absent when already met or unprojectable. */
  readyAt?: string;
  /** Which rung produced the anchor. Absent for `none`. */
  source?: RestSourceKind;
  /** The matchUp the rest is measured from. Absent for `none`. */
  fromMatchUpId?: string;
  fromMatchUpLabel?: string;
  load: RestDailyLoad;
}

/** Why rest could not be evaluated. Never reported as "rested" — an unevaluated matchUp is not a clean one. */
export type RestSkipReason = 'unknownMatchUp' | 'bye' | 'completed' | 'noParticipants';

export type RestResult =
  { evaluated: false; reason: RestSkipReason } | { evaluated: true; asOfMinutes: number; rows: RestRow[] };

const BYE = 'BYE';
const DOUBLES = 'DOUBLES';
const SINGLES = 'SINGLES';

/** The ladder, strongest first. Order is the contract; the renderer reports which rung won. */
const LADDER: { source: RestSourceKind; read: (times: NormalizedTimes) => number | undefined; projected: boolean }[] = [
  { source: 'endTime', read: (t) => t.endMinutes, projected: false },
  { source: 'scoredTime', read: (t) => t.scoredMinutes, projected: false },
  { source: 'startTime', read: (t) => t.startMinutes, projected: true },
  { source: 'calledAt', read: (t) => t.calledMinutes, projected: true },
  { source: 'scheduledTime', read: (t) => t.scheduledMinutes, projected: true },
];

interface Anchor {
  minutes: number;
  source: RestSourceKind;
}

/**
 * When the participant coming out of `matchUp` became free, in minutes.
 * Walks the ladder strongest-first; projected rungs add `averageMinutes`
 * because they mark a start rather than a finish.
 */
export function resolveAnchor(times: NormalizedTimes, timing: RestTiming): Anchor | undefined {
  for (const rung of LADDER) {
    const minutes = rung.read(times);
    if (minutes === undefined) continue;
    return { minutes: rung.projected ? minutes + timing.averageMinutes : minutes, source: rung.source };
  }
  return undefined;
}

/** True when the matchUp is under way at `asOfMinutes` — started (or due) and not yet finished. */
function isUnderWay(matchUp: ReadinessMatchUp, times: NormalizedTimes, timing: RestTiming, asOfMinutes: number) {
  if (isFinished(matchUp)) return false;
  const start = times.startMinutes ?? times.calledMinutes ?? times.scheduledMinutes;
  if (start === undefined || start > asOfMinutes) return false;
  return asOfMinutes < start + Math.max(timing.averageMinutes, 1);
}

/** Recovery owed after `prior`, accounting for a singles ↔ doubles change into `target`. */
function requirementFor(
  prior: ReadinessMatchUp,
  target: ReadinessMatchUp,
  timing: RestTiming,
): { requiredMinutes: number; typeChange: boolean } {
  const changed = !!prior.matchUpType && !!target.matchUpType && prior.matchUpType !== target.matchUpType;
  const typeChangeMinutes = timing.typeChangeRecoveryMinutes ?? 0;
  if (changed && typeChangeMinutes > 0) return { requiredMinutes: typeChangeMinutes, typeChange: true };
  return { requiredMinutes: timing.recoveryMinutes, typeChange: false };
}

/** A same-day matchUp already under way or finished, resolved once and reused across participants. */
interface PriorMatchUp {
  matchUp: ReadinessMatchUp;
  times: NormalizedTimes;
  timing: RestTiming;
  underWay: boolean;
  individuals: Set<string>;
}

/**
 * The matchUps on the viewed day that have already begun — finished or currently
 * under way. A match that has not started yet is not load the director has
 * already spent, so it is excluded; readiness reports those as `overlap` /
 * `dependency` instead.
 *
 * Resolved once per analysis rather than per participant: `timesFor` and
 * `timingFor` reach the engine, and a doubles matchUp would otherwise pay for
 * both of them four times over.
 */
function collectPriorMatchUps(target: ReadinessMatchUp, input: RestInput): PriorMatchUp[] {
  const results: PriorMatchUp[] = [];

  for (const matchUp of input.matchUps) {
    if (matchUp.matchUpId === target.matchUpId) continue;
    if (matchUp.matchUpStatus === BYE) continue;
    if (matchUp.schedule?.scheduledDate !== input.scheduledDate) continue;

    const times = input.timesFor(matchUp);
    const timing = input.timingFor(matchUp);
    const underWay = isUnderWay(matchUp, times, timing, input.asOfMinutes);
    if (!isFinished(matchUp) && !underWay) continue;
    results.push({ matchUp, times, timing, underWay, individuals: new Set(individualIds(matchUp)) });
  }
  return results;
}

/** Daily load for one participant, and which configured limits the inspected matchUp would hit. */
function loadFor(prior: PriorMatchUp[], target: ReadinessMatchUp, limits: RestDailyLimits | undefined): RestDailyLoad {
  const singles = prior.filter((entry) => entry.matchUp.matchUpType === SINGLES).length;
  const doubles = prior.filter((entry) => entry.matchUp.matchUpType === DOUBLES).length;
  const total = prior.length;
  const ordinal = total + 1;

  const atLimit: ('singles' | 'doubles' | 'total')[] = [];
  let limit: number | undefined;

  if (limits?.total !== undefined && ordinal >= limits.total) {
    atLimit.push('total');
    limit = limits.total;
  }
  if (target.matchUpType === SINGLES && limits?.SINGLES !== undefined && singles + 1 >= limits.SINGLES) {
    atLimit.push('singles');
    limit ??= limits.SINGLES;
  }
  if (target.matchUpType === DOUBLES && limits?.DOUBLES !== undefined && doubles + 1 >= limits.DOUBLES) {
    atLimit.push('doubles');
    limit ??= limits.DOUBLES;
  }

  return { singles, doubles, total, ordinal, atLimit, limit };
}

/** The most recent anchor across a participant's prior matchUps — "the last one that finished". */
function latestAnchor(
  prior: PriorMatchUp[],
): { anchor: Anchor; matchUp: ReadinessMatchUp; timing: RestTiming } | undefined {
  let best: { anchor: Anchor; matchUp: ReadinessMatchUp; timing: RestTiming } | undefined;
  for (const entry of prior) {
    const anchor = resolveAnchor(entry.times, entry.timing);
    if (!anchor) continue;
    if (!best || anchor.minutes > best.anchor.minutes) best = { anchor, matchUp: entry.matchUp, timing: entry.timing };
  }
  return best;
}

function restRowFor(
  participantId: string,
  target: ReadinessMatchUp,
  input: RestInput,
  dayMatchUps: PriorMatchUp[],
): RestRow {
  const participantName = nameFor(participantId, input.matchUps);
  const prior = dayMatchUps.filter((entry) => entry.individuals.has(participantId));
  const load = loadFor(prior, target, input.dailyLimits);

  // Still on court dominates every other reading: rest has not started, so a
  // minutes figure would be a fiction. Report the projected finish instead.
  const live = prior.find((entry) => entry.underWay);
  if (live) {
    const { requiredMinutes, typeChange } = requirementFor(live.matchUp, target, live.timing);
    const anchor = resolveAnchor(live.times, live.timing);
    return {
      participantId,
      participantName,
      status: 'onCourt',
      requiredMinutes,
      typeChange,
      ...(anchor && { readyAt: minutesToClock(anchor.minutes + requiredMinutes), source: anchor.source }),
      fromMatchUpId: live.matchUp.matchUpId,
      fromMatchUpLabel: matchUpLabel(live.matchUp),
      load,
    };
  }

  const latest = latestAnchor(prior);
  if (!latest) {
    return { participantId, participantName, status: 'none', requiredMinutes: 0, typeChange: false, load };
  }

  const { requiredMinutes, typeChange } = requirementFor(latest.matchUp, target, latest.timing);
  const restMinutes = Math.max(0, input.asOfMinutes - latest.anchor.minutes);
  const rested = restMinutes >= requiredMinutes;

  return {
    participantId,
    participantName,
    status: rested ? 'rested' : 'resting',
    restMinutes,
    requiredMinutes,
    typeChange,
    ...(!rested && { readyAt: minutesToClock(latest.anchor.minutes + requiredMinutes) }),
    source: latest.anchor.source,
    fromMatchUpId: latest.matchUp.matchUpId,
    fromMatchUpLabel: matchUpLabel(latest.matchUp),
    load,
  };
}

/**
 * Rest for every individual in one matchUp. Rows are ordered worst-first
 * (`onCourt` → `resting` → `rested` → `none`) so a renderer can take the head as
 * the headline without re-deciding severity.
 */
export function analyzeParticipantRest(input: RestInput): RestResult {
  const target = input.matchUps.find((matchUp) => matchUp.matchUpId === input.matchUpId);
  if (!target) return { evaluated: false, reason: 'unknownMatchUp' };
  if (target.matchUpStatus === BYE) return { evaluated: false, reason: 'bye' };
  if (isFinished(target)) return { evaluated: false, reason: 'completed' };

  const participantIds = individualIds(target);
  if (!participantIds.length) return { evaluated: false, reason: 'noParticipants' };

  const dayMatchUps = collectPriorMatchUps(target, input);
  const order: RestStatus[] = ['onCourt', 'resting', 'rested', 'none'];
  const rows = participantIds
    .map((participantId) => restRowFor(participantId, target, input, dayMatchUps))
    .toSorted((a, b) => order.indexOf(a.status) - order.indexOf(b.status));

  return { evaluated: true, asOfMinutes: input.asOfMinutes, rows };
}
