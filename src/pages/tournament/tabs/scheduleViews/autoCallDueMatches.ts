/**
 * Due-gated auto-call for the schedule2 "Now" strip.
 *
 * When a court has no live or already-called match, its next scheduled match is
 * auto-called (calledAt stamped) — UNLESS that match has a scheduledTime strictly
 * in the future, in which case it keeps waiting for its slot. Because the caller
 * runs this on every strip refresh (mutation + the 30s ticker), a match gets
 * called both the moment its court frees up AND the moment its scheduledTime
 * arrives. The caller gates this to today.
 *
 * Pure decision lives here; the caller fires the SET_MATCHUP_CALLED_AT mutation
 * (and, in future, notifies the called participants).
 *
 * The classifier is inlined (not imported from courthive-components'
 * computeActiveStripCell) on purpose: TMX type-checks on CI against the
 * *published* courthive-components, so depending on an export that may not be
 * published there would break the build. Keep in sync with
 * schedule-page/domain/activeStrip.ts in courthive-components.
 */

import { commitmentOf } from './timeCommitment';

export interface StripCell {
  matchUpId: string;
  drawId?: string;
  matchUpStatus?: string;
  winningSide?: number;
  /** True when at least one set/score has been entered. */
  hasScore?: boolean;
  /** ISO timestamp set when the matchUp has been called to court. */
  calledAt?: string;
  /** Opaque per-cell payload (the raw factory schedule cell — carries sides + schedule). */
  payload?: unknown;
}

export interface StripColumn {
  courtId: string;
  cells: (StripCell | null)[];
}

export interface AutoCall {
  matchUpId: string;
  drawId: string;
  /** The candidate's `HH:MM` scheduledTime, when it has one — what a time-triggered call is stamped at. */
  scheduledTime?: string;
}

export interface AutoCallPlan {
  calls: AutoCall[];
  /**
   * Candidates on an idle court held back ONLY because their scheduledTime is still ahead. When one
   * of these is called on a later pass, nothing changed but the clock: the call belongs to its
   * scheduled time, not to whenever the timer happened to fire.
   */
  awaiting: string[];
}

const IN_PROGRESS_STATUSES = new Set(['IN_PROGRESS', 'SUSPENDED']);
const COMPLETED_STATUSES = new Set([
  'CANCELLED',
  'ABANDONED',
  'COMPLETED',
  'DEAD_RUBBER',
  'DEFAULTED',
  'DOUBLE_WALKOVER',
  'DOUBLE_DEFAULT',
  'RETIRED',
  'WALKOVER',
]);

type Classification = 'live' | 'completed' | 'pending';

function classify(cell: StripCell): Classification {
  const status = cell.matchUpStatus;
  if (status && IN_PROGRESS_STATUSES.has(status)) return 'live';
  if (cell.hasScore && cell.winningSide === undefined && (!status || !COMPLETED_STATUSES.has(status))) return 'live';
  if (status && COMPLETED_STATUSES.has(status)) return 'completed';
  if (cell.winningSide !== undefined) return 'completed';
  return 'pending';
}

/** A court is occupied when it has a live match OR a pending match already called. */
function courtOccupied(column: StripColumn): boolean {
  for (const cell of column.cells) {
    if (!cell) continue;
    const kind = classify(cell);
    if (kind === 'live') return true;
    if (kind === 'pending' && cell.calledAt) return true;
  }
  return false;
}

/** The next auto-callable match: pending, un-called, decided by neither side, both participants present. */
function isCandidate(cell: StripCell | null): cell is StripCell {
  if (!cell?.matchUpId || cell.calledAt) return false;
  if (classify(cell) !== 'pending') return false;
  const sides = ((cell.payload as any)?.sides ?? []) as any[];
  const present = sides.filter((s) => s?.participantId || s?.participant?.participantId).length;
  return present >= 2;
}

/** `HH:MM` (24h) for a cell, or undefined when it carries no scheduled time. */
function scheduledTimeOf(cell: StripCell): string | undefined {
  return (cell.payload as any)?.schedule?.scheduledTime as string | undefined;
}

/**
 * True when the schedule states no time for this cell — see `commitmentOf`.
 *
 * This used to be a hand-written set of five annotations, all treated as
 * withdrawing the written time. That was wrong twice: four of the five CLEAR
 * `scheduledTime` when written, so they could never reach the comparison below;
 * and the one that can — `NOT_BEFORE` — is a FLOOR, which makes a passed time
 * more binding, not less. A matchUp annotated "not before 14:30", on an idle
 * court at 15:10 with both players known, is the clearest case of overdue there
 * is, and it was the only case the old set ever actually suppressed.
 */
function timeIsSoft(cell: StripCell): boolean {
  return commitmentOf((cell.payload as any)?.schedule) === 'none';
}

/**
 * MatchUps that should have started by now and have not been called.
 *
 * ── Why this is not just "what autocall would have called" ──
 *
 * `computeAutoCalls` follows COURT ORDER: it takes the first candidate in the
 * column and, if that one is not due yet, leaves the whole court alone. That is
 * deliberate — court order is the sequence the director stated, and a later row
 * whose time has already passed is a scheduling error that
 * `proConflicts` already reports (`CONFLICT_COURT_TIME_ORDER`) rather than something autocall should
 * quietly reorder around.
 *
 * The consequence is that such a match is **never** called, however long it
 * waits, and until now nothing said so: the court read `free` on the strip while
 * sitting idle with work on it. This scan is the display half of that — it looks
 * at every row rather than stopping at the first, so exactly the matches autocall
 * structurally cannot reach are the ones that surface.
 *
 * It also covers the cases where autocall did not run at all: a viewer who is not
 * a member of the tournament's provider never stamps `calledAt`, and neither does
 * a desk with the schedule page closed.
 *
 * Pure — the caller supplies the venue-local clock, as autocall does.
 */
export function computeDueMatchUps(columns: StripColumn[], nowHHMM: string): string[] {
  // No venue clock (a refused frame reads as '') means nothing can be measured as late.
  if (!nowHHMM) return [];
  const due: string[] = [];
  for (const column of columns) {
    // A court with something live or already called is not idle; whatever is
    // queued behind that is the grid's business, not the strip's.
    if (courtOccupied(column)) continue;
    for (const cell of column.cells) {
      if (!isCandidate(cell)) continue;
      if (timeIsSoft(cell)) continue;
      const scheduledTime = scheduledTimeOf(cell);
      // No time is not late. An unscheduled matchUp sitting on a court has never
      // claimed a moment to be measured against.
      if (!scheduledTime || scheduledTime > nowHHMM) continue;
      due.push(cell.matchUpId);
    }
  }
  return due;
}

/**
 * Which matchUps should be auto-called right now. For each court with no live or
 * called match, its first callable pending match is called unless that match's
 * scheduledTime is strictly after `nowHHMM` (24h "HH:MM").
 */
export function computeAutoCalls(columns: StripColumn[], nowHHMM: string): AutoCall[] {
  return planAutoCalls(columns, nowHHMM).calls;
}

/** `computeAutoCalls`, plus the candidates it held back for their time — see `AutoCallPlan.awaiting`. */
export function planAutoCalls(columns: StripColumn[], nowHHMM: string): AutoCallPlan {
  // No venue clock means no call. Without this, a matchUp with no scheduledTime is called on ANY
  // clock, including the '' a refused frame produces.
  if (!nowHHMM) return { calls: [], awaiting: [] };
  const calls: AutoCall[] = [];
  const awaiting: string[] = [];
  for (const column of columns) {
    if (courtOccupied(column)) continue;
    const candidate = column.cells.find(isCandidate);
    if (!candidate) continue;
    const scheduledTime = scheduledTimeOf(candidate);
    if (scheduledTime && scheduledTime > nowHHMM) {
      awaiting.push(candidate.matchUpId); // still in the future — keep waiting
      continue;
    }
    calls.push({ matchUpId: candidate.matchUpId, drawId: candidate.drawId ?? '', scheduledTime });
  }
  return { calls, awaiting };
}

/**
 * The longest a time-triggered call is backdated to its scheduled instant. The ticker runs every 30s
 * and a hidden tab's timers are throttled to about once a minute, so a genuine time-triggered call
 * lands within a minute or two. Past this the desk was not watching (a sleeping laptop, a tab closed
 * and reopened) and claiming the call happened on time would be a fabrication.
 */
export const MAX_CALL_BACKDATE_MS = 5 * 60_000;

/**
 * The instant to stamp as `calledAt` for an auto-call.
 *
 * A call is time-triggered when the previous pass saw the match `awaiting` (idle court, time not
 * yet arrived): it should read as called AT its scheduled time, not at the tick that noticed. The
 * tick lag otherwise reports an on-time call as a minute late in the Call Timing Variance report.
 * A call triggered by a court freeing up after the scheduled time keeps `nowMs` — that lateness is
 * real. Never stamps a future instant.
 */
export function autoCallStamp({
  nowMs,
  scheduledMs,
  awaited,
}: {
  nowMs: number;
  scheduledMs?: number;
  awaited: boolean;
}): number {
  if (!awaited || scheduledMs === undefined || Number.isNaN(scheduledMs)) return nowMs;
  if (scheduledMs > nowMs || nowMs - scheduledMs > MAX_CALL_BACKDATE_MS) return nowMs;
  return scheduledMs;
}
