/**
 * Schedule2 — matchUp readiness analysis (pure, DOM-free, engine-free).
 *
 * Answers, for one scheduled matchUp: *can this placement actually happen at the
 * time it is scheduled for?* Four ways it cannot:
 *
 *   - `undetermined` — a side has no participant yet because an upstream matchUp
 *     has not finished. Informational on its own; becomes a `dependency` finding
 *     when that upstream also cannot finish in time.
 *   - `dependency`   — an incomplete upstream matchUp projects to finish AFTER
 *     this one is due to start (or is not scheduled at all).
 *   - `recovery`     — a participant's earlier matchUp leaves them still in
 *     their recovery window at this matchUp's start time.
 *   - `overlap`      — a participant is due on court in another matchUp whose
 *     playing window contains this start time. Strictly worse than `recovery`,
 *     so it suppresses the recovery finding for the same participant.
 *
 * ── Why this lives in TMX, and behind an adapter ──
 *
 * The rules are domain rules and arguably belong in the factory, which already
 * has `checkRecoveryTime` inside the scheduler. But that machinery is not
 * exposed as a standalone query, and this surface needs an answer per selected
 * matchUp rather than per scheduling run. So the arithmetic lives here, while
 * every *domain value* it reasons about comes from the factory:
 *
 *   - upstream edges are inverted from hydrated `winnerMatchUpId` /
 *     `loserMatchUpId` (`nextMatchUps: true`), not re-derived from draw shape;
 *   - `averageMinutes` / `recoveryMinutes` arrive through the injected
 *     `timingFor` callback, which the caller backs with the engine's
 *     `getMatchUpFormatTiming` — the same resolution the auto-scheduler uses,
 *     including its scheduling-policy fallback.
 *
 * `ReadinessInput` → `ReadinessResult` is therefore the seam: a future factory
 * `getMatchUpReadiness` replaces this function's body and keeps the contract.
 * Nothing above the seam knows which side of it the answer came from.
 *
 * Vocabulary deliberately matches `scheduleResultsDescribe.ts` ("needs recovery
 * time", "not before HH:MM", "waiting on …") so the same condition does not read
 * two different ways on the same page.
 */

import { parseClockMinutes } from './courtTimeOrderIssues';

// constants and types

export type ReadinessKind = 'undetermined' | 'dependency' | 'recovery' | 'overlap';
export type ReadinessSeverity = 'WARN' | 'INFO';

/** The shape readiness needs off a hydrated matchUp. Structural, so the caller can pass factory output directly. */
export interface ReadinessMatchUp {
  matchUpId: string;
  matchUpStatus?: string;
  matchUpFormat?: string;
  matchUpType?: string;
  eventId?: string;
  roundName?: string;
  roundNumber?: number;
  winningSide?: number;
  winnerMatchUpId?: string;
  loserMatchUpId?: string;
  sides?: ReadinessSide[];
  schedule?: ReadinessSchedule | null;
  /**
   * Present once any score has been entered. Rest reads only whether it is
   * populated: a DEFAULTED matchUp carrying sets was played and then defaulted,
   * while a DEFAULTED matchUp with no score is a no-show who never took court.
   */
  score?: { sets?: unknown[]; scoreStringSide1?: string } | null;
}

export interface ReadinessSide {
  participantId?: string;
  participantName?: string;
  participant?: {
    participantId?: string;
    participantName?: string;
    individualParticipantIds?: string[];
    /**
     * Hydrated members of a pair or team, present on `inContext` matchUps.
     * `individualParticipantIds` carries the same identities without names, so
     * anything that must *show* a person reads this and anything that only needs
     * to compare identities reads the ids.
     */
    individualParticipants?: { participantId?: string; participantName?: string }[];
  };
}

export interface ReadinessSchedule {
  scheduledDate?: string;
  scheduledTime?: string;
  courtId?: string;
  /** Bare `HH:MM`, venue-local. Written only by an explicit operator action. */
  endTime?: string;
  /** Sparse: the calendar day the END_TIME fell on when the match crossed midnight. */
  endDate?: string;
  /** Bare `HH:MM`, venue-local. Written by start-on-drop and the manual start action. */
  startTime?: string;
  /** Full ISO instant, UTC. Stamped when the matchUp is called to court. */
  calledAt?: string;
  /** Full ISO instant, UTC. Auto-captured by the factory on first meaningful score. */
  scoredTime?: string;
}

export interface ReadinessTiming {
  averageMinutes: number;
  recoveryMinutes: number;
}

export interface ReadinessInput {
  /** The matchUp being inspected. */
  matchUpId: string;
  /** Every matchUp in the tournament, hydrated `{ inContext: true, nextMatchUps: true }`. */
  matchUps: ReadinessMatchUp[];
  /** Engine-backed timing resolution. Returning zeroes disables the time arithmetic without breaking it. */
  timingFor: (matchUp: ReadinessMatchUp) => ReadinessTiming;
}

export interface ReadinessFinding {
  kind: ReadinessKind;
  severity: ReadinessSeverity;
  participantIds?: string[];
  participantNames?: string[];
  matchUpIds?: string[];
  matchUpLabels?: string[];
  /** Earliest clock time the blocker clears, `HH:MM`. Absent when it cannot be projected. */
  notBefore?: string;
}

/** Why readiness could not be evaluated. Never reported as "ready" — an unevaluated matchUp is not a clean one. */
export type ReadinessSkipReason = 'unknownMatchUp' | 'bye' | 'completed' | 'notScheduled' | 'noTime';

export type ReadinessResult =
  { evaluated: false; reason: ReadinessSkipReason } | { evaluated: true; findings: ReadinessFinding[] };

const BYE = 'BYE';
const COMPLETED_STATUSES = new Set([
  'COMPLETED',
  'RETIRED',
  'WALKOVER',
  'DEFAULTED',
  'DOUBLE_WALKOVER',
  'DOUBLE_DEFAULT',
  'ABANDONED',
]);

/** True when a matchUp has a result and can no longer block anything. */
export function isFinished(matchUp: ReadinessMatchUp): boolean {
  return !!matchUp.winningSide || (!!matchUp.matchUpStatus && COMPLETED_STATUSES.has(matchUp.matchUpStatus));
}

/** `540` → `'09:00'`. Wraps past midnight rather than producing `25:xx`. */
export function minutesToClock(minutes: number): string {
  const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hh = Math.floor(wrapped / 60);
  const mm = wrapped % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Individual participantIds on a matchUp — expands doubles/team sides to their members. */
export function individualIds(matchUp: ReadinessMatchUp): string[] {
  const ids = new Set<string>();
  for (const side of matchUp.sides ?? []) {
    for (const id of side.participant?.individualParticipantIds ?? []) ids.add(id);
    const sideId = side.participantId ?? side.participant?.participantId;
    // A side's own participantId is only a *substitute* for its members when the
    // members are unknown — otherwise a doubles pair would be counted twice, as
    // itself and as its players, and never match the individuals on another side.
    if (sideId && !side.participant?.individualParticipantIds?.length) ids.add(sideId);
  }
  return [...ids];
}

function sideLabel(side: ReadinessSide): string {
  return side.participant?.participantName ?? side.participantName ?? 'TBD';
}

/** "R16: Alice vs Bob" — the label vocabulary the issues panel already uses. */
export function matchUpLabel(matchUp: ReadinessMatchUp): string {
  const names = (matchUp.sides ?? []).map(sideLabel);
  const players = names.length ? names.join(' vs ') : 'TBD vs TBD';
  return matchUp.roundName ? `${matchUp.roundName}: ${players}` : players;
}

/** Direct upstream feeders, inverted from the forward `winner`/`loser` edges. */
function buildFeederMap(matchUps: ReadinessMatchUp[]): Map<string, string[]> {
  const feeders = new Map<string, string[]>();
  const push = (target: string | undefined, source: string) => {
    if (!target) return;
    const list = feeders.get(target);
    if (list) list.push(source);
    else feeders.set(target, [source]);
  };
  for (const matchUp of matchUps) {
    push(matchUp.winnerMatchUpId, matchUp.matchUpId);
    push(matchUp.loserMatchUpId, matchUp.matchUpId);
  }
  return feeders;
}

/**
 * Every incomplete matchUp upstream of `matchUpId`, transitively. A grandparent
 * that has not been played blocks just as surely as a parent, and the walk stops
 * at finished matchUps because nothing behind them can still be pending.
 */
function incompleteUpstream(
  matchUpId: string,
  feeders: Map<string, string[]>,
  byId: Map<string, ReadinessMatchUp>,
): ReadinessMatchUp[] {
  const found: ReadinessMatchUp[] = [];
  const seen = new Set<string>([matchUpId]);
  const queue = [...(feeders.get(matchUpId) ?? [])];

  while (queue.length) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const matchUp = byId.get(id);
    if (!matchUp) continue;
    if (isFinished(matchUp)) continue;
    if (matchUp.matchUpStatus === BYE) continue;
    found.push(matchUp);
    queue.push(...(feeders.get(id) ?? []));
  }
  return found;
}

/** When an incomplete matchUp is projected to finish, in minutes. `null` when it cannot be projected. */
function projectedFinish(matchUp: ReadinessMatchUp, timing: ReadinessTiming): number | null {
  const start = parseClockMinutes(matchUp.schedule?.scheduledTime);
  if (start === null) return null;
  return start + timing.averageMinutes;
}

/** When a participant coming out of `matchUp` is next available, in minutes. `null` when unprojectable. */
function freeAfter(matchUp: ReadinessMatchUp, timing: ReadinessTiming): number | null {
  const end = parseClockMinutes(matchUp.schedule?.endTime);
  if (end !== null) return end + timing.recoveryMinutes;
  const start = parseClockMinutes(matchUp.schedule?.scheduledTime);
  if (start === null) return null;
  return start + timing.averageMinutes + timing.recoveryMinutes;
}

function skip(reason: ReadinessSkipReason): ReadinessResult {
  return { evaluated: false, reason };
}

/** Why the target cannot be evaluated, or undefined when it can. */
function skipReasonFor(target: ReadinessMatchUp): ReadinessSkipReason | undefined {
  if (target.matchUpStatus === BYE) return 'bye';
  if (isFinished(target)) return 'completed';
  if (!target.schedule?.scheduledDate) return 'notScheduled';
  if (parseClockMinutes(target.schedule?.scheduledTime) === null) return 'noTime';
  return undefined;
}

function undeterminedFinding(target: ReadinessMatchUp, upstream: ReadinessMatchUp[]): ReadinessFinding | undefined {
  const hasUnknownSide = (target.sides ?? []).some((side) => !(side.participantId ?? side.participant?.participantId));
  if (!hasUnknownSide || !upstream.length) return undefined;
  return {
    kind: 'undetermined',
    severity: 'INFO',
    matchUpIds: upstream.map((m) => m.matchUpId),
    matchUpLabels: upstream.map(matchUpLabel),
  };
}

function dependencyFindings(
  upstream: ReadinessMatchUp[],
  startMinutes: number,
  timingFor: ReadinessInput['timingFor'],
): ReadinessFinding[] {
  const findings: ReadinessFinding[] = [];
  for (const source of upstream) {
    const finish = projectedFinish(source, timingFor(source));
    // Unscheduled upstream: cannot be projected, and therefore cannot be
    // promised to finish in time — reported without a `notBefore`.
    if (finish === null) {
      findings.push({
        kind: 'dependency',
        severity: 'WARN',
        matchUpIds: [source.matchUpId],
        matchUpLabels: [matchUpLabel(source)],
      });
      continue;
    }
    if (finish > startMinutes) {
      findings.push({
        kind: 'dependency',
        severity: 'WARN',
        matchUpIds: [source.matchUpId],
        matchUpLabels: [matchUpLabel(source)],
        notBefore: minutesToClock(finish),
      });
    }
  }
  return findings;
}

type ParticipantClash = {
  participantId: string;
  participantName: string;
  matchUp: ReadinessMatchUp;
  notBefore?: string;
};

/** Name for a participantId, taken from whichever matchUp side carries it. */
export function nameFor(participantId: string, matchUps: ReadinessMatchUp[]): string {
  for (const matchUp of matchUps) {
    for (const side of matchUp.sides ?? []) {
      if ((side.participantId ?? side.participant?.participantId) === participantId) return sideLabel(side);
      if (side.participant?.individualParticipantIds?.includes(participantId)) return sideLabel(side);
    }
  }
  return participantId;
}

/** Other same-day matchUps that share an individual with the target. */
function sameDayNeighbours(target: ReadinessMatchUp, matchUps: ReadinessMatchUp[]): ReadinessMatchUp[] {
  const date = target.schedule?.scheduledDate;
  const targetIndividuals = new Set(individualIds(target));
  if (!targetIndividuals.size) return [];
  return matchUps.filter((matchUp) => {
    if (matchUp.matchUpId === target.matchUpId) return false;
    if (matchUp.matchUpStatus === BYE) return false;
    if (matchUp.schedule?.scheduledDate !== date) return false;
    return individualIds(matchUp).some((id) => targetIndividuals.has(id));
  });
}

/** Shared individuals between two matchUps, as clash rows. */
function clashesBetween(
  target: ReadinessMatchUp,
  neighbour: ReadinessMatchUp,
  matchUps: ReadinessMatchUp[],
): ParticipantClash[] {
  const targetIndividuals = new Set(individualIds(target));
  return individualIds(neighbour)
    .filter((id) => targetIndividuals.has(id))
    .map((participantId) => ({
      participantId,
      participantName: nameFor(participantId, matchUps),
      matchUp: neighbour,
    }));
}

function toFinding(kind: ReadinessKind, clashes: ParticipantClash[]): ReadinessFinding {
  const notBefore = clashes.map((c) => c.notBefore).find(Boolean);
  return {
    kind,
    severity: 'WARN',
    participantIds: clashes.map((c) => c.participantId),
    participantNames: [...new Set(clashes.map((c) => c.participantName))],
    matchUpIds: [...new Set(clashes.map((c) => c.matchUp.matchUpId))],
    matchUpLabels: [...new Set(clashes.map((c) => matchUpLabel(c.matchUp)))],
    ...(notBefore && { notBefore }),
  };
}

/**
 * Overlap and recovery in one pass, because they are the same question asked at
 * two strengths and must not both fire for one participant: overlap means the
 * participant is *on court elsewhere* at this start time, which already implies
 * the recovery window is violated.
 */
function clashFindings(
  target: ReadinessMatchUp,
  startMinutes: number,
  matchUps: ReadinessMatchUp[],
  timingFor: ReadinessInput['timingFor'],
): ReadinessFinding[] {
  const overlapping: ParticipantClash[] = [];
  const recovering: ParticipantClash[] = [];
  const overlappedIds = new Set<string>();

  for (const neighbour of sameDayNeighbours(target, matchUps)) {
    const timing = timingFor(neighbour);
    const neighbourStart = parseClockMinutes(neighbour.schedule?.scheduledTime);
    const clashes = clashesBetween(target, neighbour, matchUps);
    if (!clashes.length) continue;

    const isOverlap =
      !isFinished(neighbour) &&
      neighbourStart !== null &&
      neighbourStart <= startMinutes &&
      startMinutes < neighbourStart + Math.max(timing.averageMinutes, 1);

    if (isOverlap) {
      overlapping.push(...clashes);
      for (const clash of clashes) overlappedIds.add(clash.participantId);
      continue;
    }

    const free = freeAfter(neighbour, timing);
    if (free === null || free <= startMinutes) continue;
    recovering.push(...clashes.map((clash) => ({ ...clash, notBefore: minutesToClock(free) })));
  }

  const stillRecovering = recovering.filter((clash) => !overlappedIds.has(clash.participantId));
  const findings: ReadinessFinding[] = [];
  if (overlapping.length) findings.push(toFinding('overlap', overlapping));
  if (stillRecovering.length) findings.push(toFinding('recovery', stillRecovering));
  return findings;
}

/**
 * Readiness for one scheduled matchUp. Findings are ordered strongest-first
 * (`overlap` → `dependency` → `recovery` → `undetermined`) so a renderer can
 * take the head as the headline without re-deciding severity.
 */
export function analyzeMatchUpReadiness(input: ReadinessInput): ReadinessResult {
  const byId = new Map(input.matchUps.map((matchUp) => [matchUp.matchUpId, matchUp]));
  const target = byId.get(input.matchUpId);
  if (!target) return skip('unknownMatchUp');

  const reason = skipReasonFor(target);
  if (reason) return skip(reason);

  const startMinutes = parseClockMinutes(target.schedule?.scheduledTime) as number;
  const upstream = incompleteUpstream(target.matchUpId, buildFeederMap(input.matchUps), byId);

  const findings: ReadinessFinding[] = [
    ...clashFindings(target, startMinutes, input.matchUps, input.timingFor),
    ...dependencyFindings(upstream, startMinutes, input.timingFor),
  ];

  const undetermined = undeterminedFinding(target, upstream);
  if (undetermined) findings.push(undetermined);

  const order: ReadinessKind[] = ['overlap', 'dependency', 'recovery', 'undetermined'];
  return { evaluated: true, findings: findings.toSorted((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)) };
}
