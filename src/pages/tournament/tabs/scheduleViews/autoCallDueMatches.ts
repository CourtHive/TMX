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

/**
 * Which matchUps should be auto-called right now. For each court with no live or
 * called match, its first callable pending match is called unless that match's
 * scheduledTime is strictly after `nowHHMM` (24h "HH:MM").
 */
export function computeAutoCalls(columns: StripColumn[], nowHHMM: string): AutoCall[] {
  const calls: AutoCall[] = [];
  for (const column of columns) {
    if (courtOccupied(column)) continue;
    const candidate = column.cells.find(isCandidate);
    if (!candidate) continue;
    const scheduledTime = (candidate.payload as any)?.schedule?.scheduledTime as string | undefined;
    if (scheduledTime && scheduledTime > nowHHMM) continue; // still in the future — keep waiting
    calls.push({ matchUpId: candidate.matchUpId, drawId: candidate.drawId ?? '' });
  }
  return calls;
}
