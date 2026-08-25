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
 * The ladder degrades on **unusable**, not merely on absent. A rung that holds a
 * value can still be unreadable — anything landing after "now" is not a finish
 * that has happened — and an earlier design stopped at the first rung with a
 * value, discovered the problem afterwards, and reported the whole row as
 * unmeasurable. It had four weaker answers in hand and used none of them: a
 * semifinal at 09:00 plus its format average dates the finish perfectly well.
 * `resolveAnchors` therefore returns every rung, and the caller takes the
 * strongest one that is actually behind the clock. `anchorUnreliable` is
 * reserved for the case where the whole ladder is in the future.
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
  /**
   * Local calendar date of `scoredTime`, `YYYY-MM-DD`. Carried separately from
   * `scoredMinutes` because that value is clamped into the viewed day's clock
   * and so can no longer say which day it came from — and dating a matchUp is
   * the one question that needs the unclamped answer.
   */
  scoredDate?: string;
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
  /**
   * True when the participant is still on court past the point their format was
   * expected to finish. The projected finish is now in the past, so `readyAt` is
   * withheld rather than naming a time that has already gone by.
   */
  overrun?: boolean;
  /**
   * True when every anchor available for this participant projects into the
   * future — the match is recorded as finished but nothing says when. Rest is
   * reported as zero rather than guessed.
   */
  anchorUnreliable?: boolean;
  /** Which rung produced the anchor. Absent for `none`. */
  source?: RestSourceKind;
  /**
   * Rungs the ladder passed over on its way to `source`, strongest first. Present
   * only when something was actually skipped.
   *
   * A silent fall-through is a fix that hides its own cause: the row reads as a
   * clean estimate while a recorded stamp sits in the record contradicting it.
   * Every reason for skipping one is a fault worth someone's attention — a score
   * filed the next day, or a page asking about the wrong day.
   */
  discardedSources?: RestSourceKind[];
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

/**
 * Statuses that advance a participant without their playing. A walkover costs no
 * energy, so charging recovery for one holds a fresh player back — and counting
 * it toward a daily match limit can block a player who has not played all day.
 *
 * `DEFAULTED` / `DOUBLE_DEFAULT` are deliberately absent: a default can be a
 * no-show *or* a mid-match disqualification. The score tells them apart, so they
 * are decided by `wasPlayed` rather than by status alone. `RETIRED` and
 * `ABANDONED` are likewise absent — both mean time was spent on court.
 *
 * `CANCELLED` is here to match `factory/src/query/reports/recoveryTimeline.ts`,
 * which ported this predicate from this file and added it. Two copies of one rule
 * that disagree by a status is how a director gets one rest figure in the
 * Inspector and a different one in the recovery report for the same matchUp; a
 * cancelled matchUp plainly put nobody on court, so the factory's set is right
 * and this one follows it.
 *
 * **That agreement is enforced, not merely requested.**
 * `wasPlayedConformance.test.ts` drives the factory's own Participant Recovery
 * report over one matchUp per status and checks this predicate reaches the same
 * verdict. If you change the set below, that test tells you whether the factory
 * agrees — and if it does not, the factory is right and this file follows.
 */
const UNPLAYED_STATUSES = new Set(['WALKOVER', 'DOUBLE_WALKOVER', 'CANCELLED']);
const DEFAULT_STATUSES = new Set(['DEFAULTED', 'DOUBLE_DEFAULT']);

/** True when this matchUp actually put the participants on court. */
export function wasPlayed(matchUp: ReadinessMatchUp): boolean {
  const status = matchUp.matchUpStatus;
  if (status && UNPLAYED_STATUSES.has(status)) return false;
  // A default with a score was played up to the point of the default; a default
  // with no score is a no-show. Nothing else about the record distinguishes them.
  if (status && DEFAULT_STATUSES.has(status)) return !!matchUp.score?.sets?.length;
  return true;
}

/**
 * Whether a matchUp belongs to the day being viewed.
 *
 * `scheduledDate` answers it outright when present. When it is absent — which is
 * what a score entered from the draw view leaves behind — `scoredTime` still
 * dates the match, via the stamp's own local calendar date.
 *
 * That date is compared directly rather than inferred from `scoredMinutes`
 * falling inside `0..1439`. The range test was a proxy for the same question and
 * stopped being one when `scoredMinutes` began clamping to the viewed day's
 * clock: every stamp now lands in range, so the proxy would admit a match from
 * any day at all. A matchUp with neither a scheduledDate nor a scoredTime is
 * genuinely undatable and is excluded, since counting it would be a guess about
 * which day's rest it belongs to.
 */
export function occursOnViewedDay(matchUp: ReadinessMatchUp, times: NormalizedTimes, viewedDate: string): boolean {
  const scheduledDate = matchUp.schedule?.scheduledDate;
  if (scheduledDate) return scheduledDate === viewedDate;
  return times.scoredDate !== undefined && times.scoredDate === viewedDate;
}

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
  /**
   * True when a recorded finish sits an implausible distance from its own start —
   * bookkeeping rather than play. Projected rungs are derived FROM the start and
   * so are plausible by construction.
   */
  implausible?: boolean;
}

/**
 * How far after its own start a recorded finish may sit and still be a finish.
 *
 * Twelve hours covers any real match including a long weather suspension, while
 * excluding a score entered the next day. Matches
 * `MAX_PLAUSIBLE_MATCH_MINUTES` in `factory/src/query/reports/recoveryTimeline.ts`
 * so the Inspector and the recovery report reject the same stamps.
 */
const MAX_PLAUSIBLE_MATCH_MINUTES = 12 * 60;

/**
 * Whether a recorded finish sits a plausible distance after a known start.
 *
 * **Deliberate divergence from the factory**, which returns false when there is
 * no start at all. That module computes a *duration*, which is meaningless
 * without one. This module computes a *finish anchor*, which is not: a score
 * entered from the draw view leaves neither a scheduledTime nor a startTime, and
 * its stamp is then the only evidence the match happened. With nothing to
 * contradict, there is nothing to reject.
 */
function isPlausibleFinish(finishMinutes: number, startMinutes?: number): boolean {
  if (startMinutes === undefined) return true;
  const elapsed = finishMinutes - startMinutes;
  return elapsed > 0 && elapsed <= MAX_PLAUSIBLE_MATCH_MINUTES;
}

/**
 * Every reading of when the participant coming out of `matchUp` became free,
 * strongest first. Projected rungs add `averageMinutes` because they mark a
 * start rather than a finish.
 *
 * All of them, not just the winner: whether a rung is usable depends on the
 * clock, which is the caller's to hold. Handing back one answer forced the
 * caller to accept it or report nothing.
 */
export function resolveAnchors(times: NormalizedTimes, timing: RestTiming): Anchor[] {
  const startReference = times.startMinutes ?? times.calledMinutes ?? times.scheduledMinutes;
  return LADDER.flatMap((rung) => {
    const minutes = rung.read(times);
    if (minutes === undefined) return [];
    if (rung.projected) return [{ minutes: minutes + timing.averageMinutes, source: rung.source }];
    const implausible = !isPlausibleFinish(minutes, startReference);
    return [{ minutes, source: rung.source, ...(implausible && { implausible: true }) }];
  });
}

/** The strongest available reading, ignoring whether it is usable. Correct for a live matchUp, whose finish IS ahead. */
export function resolveAnchor(times: NormalizedTimes, timing: RestTiming): Anchor | undefined {
  return resolveAnchors(times, timing).at(0);
}

/**
 * True when the matchUp is under way at `asOfMinutes` — started (or due) and not
 * yet finished.
 *
 * Deliberately **unbounded above**. An earlier version closed the window at
 * `start + averageMinutes`, which meant a match that ran long stopped counting as
 * under way while remaining unfinished, so it was dropped from the analysis
 * entirely and the player read as having no match today — while standing on
 * court. `averageMinutes` is an estimate of a typical match; a match is over when
 * a result says so, not when the estimate expires.
 */
function isUnderWay(matchUp: ReadinessMatchUp, times: NormalizedTimes, asOfMinutes: number) {
  if (isFinished(matchUp)) return false;
  const start = times.startMinutes ?? times.calledMinutes ?? times.scheduledMinutes;
  return start !== undefined && start <= asOfMinutes;
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
    // A walkover is not load the director has spent — it neither tires a player
    // nor consumes a slot against the daily limit.
    if (!wasPlayed(matchUp)) continue;

    // Times are resolved before the day test because an undated matchUp is dated
    // by its `scoredTime`, which only exists in normalized form.
    const times = input.timesFor(matchUp);
    if (!occursOnViewedDay(matchUp, times, input.scheduledDate)) continue;

    const timing = input.timingFor(matchUp);
    const underWay = isUnderWay(matchUp, times, input.asOfMinutes);
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

interface AnchoredPrior {
  anchor: Anchor;
  matchUp: ReadinessMatchUp;
  timing: RestTiming;
  /** Rungs passed over on the way to `anchor`, strongest first. */
  discarded: RestSourceKind[];
}

/**
 * The rung one prior matchUp should be read from, and what was passed over.
 *
 * Two reasons to skip a rung, and they are different faults. **Implausible**: the
 * stamp sits more than a match's length from its own start, so it records
 * bookkeeping rather than play. **Ahead of now**: a finish that has not happened,
 * which is a projection on a matchUp recorded complete early, or a page asking
 * about a day other than the one the stamp belongs to.
 *
 * When nothing is readable the strongest *plausible* rung is still named, so the
 * row can point at the matchUp it failed to measure rather than at a stamp it has
 * already rejected. `discarded` then carries only the rungs the gate threw out —
 * "everything is in the future" is what `anchorUnreliable` already says.
 */
function selectAnchor(
  anchors: Anchor[],
  asOfMinutes: number,
): { anchor: Anchor; usable: boolean; discarded: RestSourceKind[] } | undefined {
  const readable = anchors.findIndex((anchor) => !anchor.implausible && anchor.minutes <= asOfMinutes);
  if (readable >= 0) {
    return { anchor: anchors[readable], usable: true, discarded: anchors.slice(0, readable).map((a) => a.source) };
  }

  const plausible = anchors.findIndex((anchor) => !anchor.implausible);
  const index = plausible >= 0 ? plausible : 0;
  const anchor = anchors.at(index);
  return anchor && { anchor, usable: false, discarded: anchors.slice(0, index).map((a) => a.source) };
}

/**
 * The most recent usable anchor across a participant's prior matchUps — "the last
 * one that finished".
 *
 * Two selections, and they are ordered differently on purpose. *Within* one
 * matchUp the ladder decides: take the strongest rung that is at or before
 * `asOfMinutes`, so a recorded finish outranks a projection but a projection is
 * still reached for when the recorded value cannot be read. *Across* matchUps the
 * clock decides: the latest of those wins, because rest runs from the last time
 * the player walked off.
 *
 * An anchor *after* now is not a finish that has happened — a matchUp recorded as
 * complete ahead of its slot, or a score filed under a day other than the one it
 * was entered on. Treating one as a finish produced `0m of 60m` for a player who
 * had not played, because the negative interval was clamped to zero. Skipping the
 * rung and trying the next one is what keeps a single unreadable stamp from
 * taking the whole row down with it.
 *
 * When every rung of every prior matchUp is in the future the matches still
 * happened, so reporting "no prior match" would fail open. The caller is handed
 * the earliest future anchor and told, via `unreliable`, that it cannot carry a
 * rest figure.
 */
function latestAnchor(
  prior: PriorMatchUp[],
  asOfMinutes: number,
): (AnchoredPrior & { unreliable: boolean }) | undefined {
  let past: AnchoredPrior | undefined;
  let future: AnchoredPrior | undefined;

  for (const entry of prior) {
    const selected = selectAnchor(resolveAnchors(entry.times, entry.timing), asOfMinutes);
    if (!selected) continue;
    const { anchor, usable, discarded } = selected;
    const candidate = { anchor, matchUp: entry.matchUp, timing: entry.timing, discarded };
    if (usable) {
      if (!past || anchor.minutes > past.anchor.minutes) past = candidate;
    } else if (!future || anchor.minutes < future.anchor.minutes) {
      future = candidate;
    }
  }

  if (past) return { ...past, unreliable: false };
  return future && { ...future, unreliable: true };
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
    // The anchor for a live matchUp is a *projected* finish. Once that projection
    // has passed, the match has overrun its format's average and the projection
    // has expired with it — naming a readyAt in the past would read as though the
    // player were already free, which is exactly backwards.
    const overrun = !!anchor && anchor.minutes <= input.asOfMinutes;
    const readyAt = anchor && !overrun ? minutesToClock(anchor.minutes + requiredMinutes) : undefined;
    return {
      participantId,
      participantName,
      status: 'onCourt',
      requiredMinutes,
      typeChange,
      ...(readyAt && { readyAt }),
      ...(overrun && { overrun: true }),
      ...(anchor && { source: anchor.source }),
      fromMatchUpId: live.matchUp.matchUpId,
      fromMatchUpLabel: matchUpLabel(live.matchUp),
      load,
    };
  }

  const latest = latestAnchor(prior, input.asOfMinutes);
  if (!latest) {
    return { participantId, participantName, status: 'none', requiredMinutes: 0, typeChange: false, load };
  }

  const { requiredMinutes, typeChange } = requirementFor(latest.matchUp, target, latest.timing);
  // An unreliable anchor sits in the future, so no interval can be measured from
  // it. Zero rest against a real requirement is the conservative reading — it
  // holds the player back — and `anchorUnreliable` keeps that from reading as a
  // measured figure. No `readyAt` either: the clock time would be as fictional
  // as the interval.
  const restMinutes = latest.unreliable ? 0 : input.asOfMinutes - latest.anchor.minutes;
  const rested = !latest.unreliable && restMinutes >= requiredMinutes;
  const showReadyAt = !rested && !latest.unreliable;

  return {
    participantId,
    participantName,
    status: rested ? 'rested' : 'resting',
    restMinutes,
    requiredMinutes,
    typeChange,
    ...(showReadyAt && { readyAt: minutesToClock(latest.anchor.minutes + requiredMinutes) }),
    ...(latest.unreliable && { anchorUnreliable: true }),
    ...(latest.discarded.length && { discardedSources: latest.discarded }),
    source: latest.anchor.source,
    fromMatchUpId: latest.matchUp.matchUpId,
    fromMatchUpLabel: matchUpLabel(latest.matchUp),
    load,
  };
}

/**
 * How far short of ready a row is, in minutes. The within-band tiebreak: sorting
 * by status alone left `individualIds` side order to decide which player the
 * badge spoke for, so a doubles pair resting at 10m and 40m badged whichever
 * happened to be listed first. `onCourt` and `none` carry no measurable deficit,
 * so they return 0 and keep their original order.
 */
function deficitMinutes(row: RestRow): number {
  if (row.status === 'onCourt' || row.status === 'none') return 0;
  return row.requiredMinutes - (row.restMinutes ?? 0);
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
    .toSorted((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || deficitMinutes(b) - deficitMinutes(a));

  return { evaluated: true, asOfMinutes: input.asOfMinutes, rows };
}
