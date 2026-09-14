/**
 * Schedule2 — how long a court has before its next availability block.
 *
 * The Now strip already shows a block that is IN FORCE. What it has never shown
 * is the one bearing down: a court free until 15:30 looks exactly like a court
 * free all evening, and a match placed on the first one gets interrupted.
 *
 * The arithmetic is not new. `checkBlockInterruption` in `gridView.ts` has
 * computed it since the drop-confirm was added — but only at the moment of a
 * drop, and only as a modal that disappears when the operator clicks through it.
 * This is the same fact, kept on screen.
 *
 * ── Two shapes, because the question differs ──
 *
 * On an IDLE court the question is "can I still put something here", and the
 * answer is a duration: `40m → MAINTENANCE`. On an OCCUPIED court the question
 * is already settled — something is there — so the only thing worth saying is
 * that it will be interrupted, which is a mark on the cell rather than a figure.
 *
 * ── When the idle-court figure appears ──
 *
 * Only once a typical match no longer fits. That threshold is the tournament's
 * own scheduling-policy average (`getMatchUpFormatTiming`), not a constant, and
 * it is chosen so that the NUMBER APPEARING is itself the signal: it shows up
 * exactly when the answer to "can I put something here" turns from yes to no.
 * Showing it all day — on a court that closes at 18:00, from breakfast onward —
 * would make it furniture.
 *
 * Pure: minutes-from-midnight in, a decision out. The venue-clock conversion and
 * the engine calls live in `gridView`, which already does both for the banner.
 */

/** A block window on one court, normalised to venue-local minutes from midnight. */
export interface CourtBlockWindow {
  courtId: string;
  type: string;
  startMinutes: number;
  endMinutes: number;
}

export interface CourtBlockSignalInput {
  courtId: string;
  nowMinutes: number;
  blocks: CourtBlockWindow[];
  /** What a typical match costs here — the policy average, not a constant. */
  averageMinutes: number;
  /**
   * When the matchUp currently on this court is expected to finish. Absent for
   * an idle court, which is what selects between the two shapes.
   */
  occupiedUntilMinutes?: number;
}

export type CourtBlockSignal =
  { kind: 'runway'; type: string; minutes: number } | { kind: 'edge'; type: string; minutes: number };

/** The earliest block on this court that has not started yet. */
function nextBlock(input: CourtBlockSignalInput): CourtBlockWindow | undefined {
  return input.blocks
    .filter((block) => block.courtId === input.courtId && block.startMinutes > input.nowMinutes)
    .toSorted((a, b) => a.startMinutes - b.startMinutes)
    .at(0);
}

/** True when a block is in force right now — the banner's job, not this one's. */
function blockedNow(input: CourtBlockSignalInput): boolean {
  return input.blocks.some(
    (block) =>
      block.courtId === input.courtId && block.startMinutes <= input.nowMinutes && block.endMinutes > input.nowMinutes,
  );
}

/**
 * What this court should say about its next block, or undefined for the ordinary
 * case where there is nothing worth saying.
 *
 * Undefined covers four distinct situations on purpose — no upcoming block, a
 * block already in force, an idle court with room for a match, and an occupied
 * court whose match finishes first. None of them is an exception; all of them
 * are "carry on".
 */
export function courtBlockSignal(input: CourtBlockSignalInput): CourtBlockSignal | undefined {
  // A block in force is already on screen as a banner. Counting down to the NEXT
  // one behind it would be answering a question nobody has yet.
  if (blockedNow(input)) return undefined;

  const next = nextBlock(input);
  if (!next) return undefined;

  const minutes = next.startMinutes - input.nowMinutes;

  if (input.occupiedUntilMinutes !== undefined) {
    // The match is expected to finish first, so the block is not its problem.
    if (next.startMinutes >= input.occupiedUntilMinutes) return undefined;
    return { kind: 'edge', type: next.type, minutes };
  }

  // Idle: silent while a match still fits. See the header on why the figure's
  // appearance is the signal.
  if (minutes >= input.averageMinutes) return undefined;
  return { kind: 'runway', type: next.type, minutes };
}

/** `40m`, `2h 05m` — the runway's own figure, deliberately a duration and not a clock time. */
export function formatRunway(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  if (safe < 60) return `${safe}m`;
  return `${Math.floor(safe / 60)}h ${String(safe % 60).padStart(2, '0')}m`;
}
