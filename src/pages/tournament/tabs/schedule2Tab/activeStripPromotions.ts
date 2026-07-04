/**
 * Auto-promotion detection for the schedule2 "Now" strip.
 *
 * The strip surfaces one cell per court (in-progress → next-pending → free).
 * When a court's Now occupant finishes, the strip re-derives and the next
 * scheduled matchUp rises into the Now slot — a purely visual promotion that
 * fires no mutation. A deliberate drag-to-strip stamps `matchUp.schedule.calledAt`
 * (see commitActiveStripDrop); an auto-promotion should read as the same
 * "called to court" signal, so callers stamp the promoted matchUp too.
 *
 * This module holds the pure decision: given the previous Now occupant per
 * court and the freshly-built strip columns, which matchUps were just promoted
 * and what the new per-court baseline is. Side effects (firing the mutation)
 * live in the caller.
 *
 * The Now-slot classifier is inlined (rather than imported from
 * courthive-components' `computeActiveStripCell`) on purpose: TMX type-checks on
 * CI against the *published* courthive-components, so depending on an export
 * that may not be published yet would break the build there. Keep this in sync
 * with `schedule-page/domain/activeStrip.ts` in courthive-components.
 */

export interface StripCell {
  matchUpId: string;
  drawId?: string;
  matchUpStatus?: string;
  winningSide?: number;
  /** True when at least one set/score has been entered. */
  hasScore?: boolean;
  /** Opaque per-cell payload (the raw factory schedule cell). */
  payload?: unknown;
}

export interface StripColumn {
  courtId: string;
  cells: (StripCell | null)[];
}

export interface StripPromotion {
  matchUpId: string;
  drawId: string;
}

export interface StripPromotionResult {
  /** MatchUps that rose into a Now slot because the prior occupant completed. */
  promotions: StripPromotion[];
  /** New per-court Now-occupant baseline, to carry into the next pass. */
  nextNowByCourt: Map<string, string>;
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

const LIVE = 'in-progress' as const;
type Classification = typeof LIVE | 'completed' | 'pending';

function classify(cell: StripCell): Classification {
  const status = cell.matchUpStatus;
  if (status && IN_PROGRESS_STATUSES.has(status)) return LIVE;
  if (cell.hasScore && cell.winningSide === undefined && (!status || !COMPLETED_STATUSES.has(status))) {
    return LIVE;
  }
  if (status && COMPLETED_STATUSES.has(status)) return 'completed';
  if (cell.winningSide !== undefined) return 'completed';
  return 'pending';
}

/** The cell surfaced in a court's "Now" slot: in-progress → first pending → none. */
function computeNowCell(column: StripColumn): { matchUp?: StripCell; state: typeof LIVE | 'next' | 'free' } {
  let firstPending: StripCell | undefined;
  for (const cell of column.cells) {
    if (!cell) continue;
    const kind = classify(cell);
    if (kind === LIVE) return { matchUp: cell, state: LIVE };
    if (kind === 'pending' && !firstPending) firstPending = cell;
  }
  if (firstPending) return { matchUp: firstPending, state: 'next' };
  return { state: 'free' };
}

export function computeStripPromotions(
  prevNowByCourt: Map<string, string>,
  columns: StripColumn[],
): StripPromotionResult {
  const promotions: StripPromotion[] = [];
  const nextNowByCourt = new Map<string, string>();

  for (const column of columns) {
    const cell = computeNowCell(column);
    const nowMatchUp = cell.matchUp;
    const nowId = nowMatchUp?.matchUpId;
    if (nowId) nextNowByCourt.set(column.courtId, nowId);

    const prevId = prevNowByCourt.get(column.courtId);
    // No baseline yet (first observation of this court) or an unchanged Now
    // slot — nothing was promoted this pass.
    if (!prevId || !nowId || prevId === nowId) continue;
    // Only a freshly-surfaced PENDING matchUp counts as "called to court"; an
    // in-progress or completed Now cell isn't a fresh promotion.
    if (cell.state !== 'next') continue;

    // The prior Now occupant must still sit in this court's column AND be
    // completed — that distinguishes a genuine "previous match finished, next
    // is up" promotion from a re-order, an unschedule, or a date switch (where
    // the prior matchUp is absent from the new column entirely).
    const prevCell = column.cells.find((c) => c?.matchUpId === prevId);
    if (!prevCell || classify(prevCell) !== 'completed') continue;

    // Never restamp a matchUp that was already deliberately called to court.
    const alreadyCalled = !!(nowMatchUp?.payload as any)?.schedule?.calledAt;
    if (alreadyCalled) continue;

    promotions.push({ matchUpId: nowId, drawId: nowMatchUp?.drawId ?? '' });
  }

  return { promotions, nextNowByCourt };
}
