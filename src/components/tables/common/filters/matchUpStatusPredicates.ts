/**
 * Shared matchUp status predicates.
 *
 * Single source of truth for status classification used by both the popover
 * status filter and the matchUps-page "Today view" bar. Keeping the bucketing
 * here guarantees the count a segment shows equals the rows you get when you
 * click it to filter.
 *
 * Two vocabularies live here:
 *   - `classifyTodayBucket` — a mutually-exclusive partition into the five
 *     day-of-play buckets the Today bar renders.
 *   - `popoverStatusPredicate` — the human-friendly popover options (which are
 *     intentionally NOT a partition: "To be played" folds in SUSPENDED, etc.).
 */

const WALKOVER_STATUSES = new Set(['WALKOVER', 'DOUBLE_WALKOVER', 'DEFAULTED', 'DOUBLE_DEFAULT']);
const COMPLETE_STATUSES = new Set(['DOUBLE_WALKOVER', 'DOUBLE_DEFAULT', 'CANCELLED', 'ABANDONED']);

// Today-view partition buckets (order defines the segment layout).
export const TODAY_BUCKETS = ['complete', 'live', 'suspended', 'called', 'readyToScore', 'notReady'] as const;
export type TodayBucket = (typeof TODAY_BUCKETS)[number];

/** Prefix distinguishing bar-driven status tokens from popover tokens. */
export const TODAY_STATUS_PREFIX = 'today:';

function statusOf(rowData: any): string | undefined {
  return rowData?.scoreDetail?.matchUpStatus ?? rowData?.matchUpStatus;
}

function isComplete(rowData: any): boolean {
  const status = statusOf(rowData);
  return !!(rowData.winningSide || rowData.complete || (status && COMPLETE_STATUSES.has(status)));
}

/**
 * True when the row carries a `calledAt` stamp belonging to the day it is
 * scheduled on. `calledAt` is a full ISO instant and survives a reschedule as
 * historical record (only an explicit unschedule clears it), so a stamp from an
 * earlier day must not make a match look called for today. Compared in local
 * wall-clock — the same convention the calledAt column and the Call Timing
 * Variance report use, and on-site local time is venue time.
 */
function isCalledForScheduledDay(rowData: any): boolean {
  const calledAt = rowData?.calledAt;
  if (!calledAt) return false;
  const called = new Date(calledAt);
  if (Number.isNaN(called.getTime())) return false;
  if (!rowData.scheduledDate) return true;
  const pad = (n: number) => String(n).padStart(2, '0');
  const localDate = `${called.getFullYear()}-${pad(called.getMonth() + 1)}-${pad(called.getDate())}`;
  return localDate === rowData.scheduledDate;
}

/**
 * Mutually-exclusive classification of a matchUp into a Today-view bucket.
 * Precedence: complete → suspended → live → called → readyToScore → notReady.
 *
 * `called` splits the ready-to-score population: matches already sent on court
 * (a `calledAt` stamp for their scheduled day) versus those still waiting to be
 * called, which is the distinction a director scans the bar for.
 */
export function classifyTodayBucket(rowData: any): TodayBucket {
  const status = statusOf(rowData);
  if (isComplete(rowData)) return 'complete';
  if (status === 'SUSPENDED') return 'suspended';
  if (status === 'IN_PROGRESS' || (rowData.score && !rowData.winningSide)) return 'live';
  if (rowData.readyToScore) return isCalledForScheduledDay(rowData) ? 'called' : 'readyToScore';
  return 'notReady';
}

/** Predicate for the popover status options (not a partition). */
export function popoverStatusPredicate(rowData: any, filterValue: string): boolean {
  const status = statusOf(rowData);
  if (filterValue === 'toBePlayed') return status === 'TO_BE_PLAYED' || status === 'SUSPENDED';
  if (filterValue === 'suspended') return status === 'SUSPENDED';
  if (filterValue === 'readyToScore') {
    return rowData.readyToScore && !rowData.score && !rowData.winningSide && !COMPLETE_STATUSES.has(status ?? '');
  }
  if (filterValue === 'complete') return isComplete(rowData);
  if (filterValue === 'retired') return status === 'RETIRED';
  if (filterValue === 'irregularEnding') return status === 'DEFAULTED' || status === 'WALKOVER';
  // ABANDONED / CANCELLED are non-directing (voided, no winner) — a distinct
  // category from irregular endings, which produce a winner.
  if (filterValue === 'abandoned') return status === 'ABANDONED';
  if (filterValue === 'cancelled') return status === 'CANCELLED';
  return true;
}

/** Predicate for a WALKOVER/defaulted competitiveness profile bucket. */
export function isWalkoverProfile(rowData: any): boolean {
  const status = statusOf(rowData);
  return !!status && WALKOVER_STATUSES.has(status);
}
