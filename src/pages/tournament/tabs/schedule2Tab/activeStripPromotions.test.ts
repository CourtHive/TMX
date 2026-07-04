import { describe, it, expect } from 'vitest';
import { computeStripPromotions } from './activeStripPromotions';

// Minimal cell factory matching the StripCell shape consumed by
// computeStripPromotions. `payload.schedule.calledAt` mirrors the raw factory
// schedule cell that buildActiveStripData stashes on each cell.
function cell(overrides: any = {}) {
  const { calledAt, ...rest } = overrides;
  return {
    matchUpId: 'mu',
    drawId: 'draw',
    participantIds: ['a', 'b'],
    payload: { schedule: calledAt !== undefined ? { calledAt } : {} },
    ...rest,
  };
}

const completed = (id: string, extra: any = {}) =>
  cell({ matchUpId: id, matchUpStatus: 'COMPLETED', winningSide: 1, ...extra });
const pending = (id: string, extra: any = {}) => cell({ matchUpId: id, matchUpStatus: 'TO_BE_PLAYED', ...extra });
const inProgress = (id: string, extra: any = {}) =>
  cell({ matchUpId: id, matchUpStatus: 'IN_PROGRESS', hasScore: true, ...extra });

const column = (courtId: string, cells: any[]) => ({ courtId, cells });

describe('computeStripPromotions', () => {
  it('seeds a baseline without promoting on first observation', () => {
    const columns = [column('c1', [inProgress('A'), pending('B')])];
    const { promotions, nextNowByCourt } = computeStripPromotions(new Map(), columns);

    expect(promotions).toEqual([]);
    expect(nextNowByCourt.get('c1')).toBe('A');
  });

  it('promotes the next matchUp when the prior Now occupant completes', () => {
    // Prior baseline: A occupied the Now slot. Now A is completed and B (pending)
    // has risen into the Now slot on the same court.
    const columns = [column('c1', [completed('A'), pending('B')])];
    const prev = new Map([['c1', 'A']]);

    const { promotions, nextNowByCourt } = computeStripPromotions(prev, columns);

    expect(promotions).toEqual([{ matchUpId: 'B', drawId: 'draw' }]);
    expect(nextNowByCourt.get('c1')).toBe('B');
  });

  it('does not promote while the Now occupant is still in progress', () => {
    const columns = [column('c1', [inProgress('A'), pending('B')])];
    const prev = new Map([['c1', 'A']]);

    const { promotions } = computeStripPromotions(prev, columns);
    expect(promotions).toEqual([]);
  });

  it('does not restamp a matchUp that was already called to court', () => {
    const columns = [column('c1', [completed('A'), pending('B', { calledAt: '2026-07-04T10:00:00.000Z' })])];
    const prev = new Map([['c1', 'A']]);

    const { promotions, nextNowByCourt } = computeStripPromotions(prev, columns);
    expect(promotions).toEqual([]);
    // Baseline still advances so a later genuine change is detected.
    expect(nextNowByCourt.get('c1')).toBe('B');
  });

  it('does not promote when the Now slot changes via re-order (prior not completed)', () => {
    // C was dropped above the previous Now occupant B; B is still pending, so
    // this is a re-order, not a "previous finished" promotion.
    const columns = [column('c1', [pending('C'), pending('B')])];
    const prev = new Map([['c1', 'B']]);

    const { promotions, nextNowByCourt } = computeStripPromotions(prev, columns);
    expect(promotions).toEqual([]);
    expect(nextNowByCourt.get('c1')).toBe('C');
  });

  it('does not false-promote across a date switch (prior matchUp absent from column)', () => {
    // Prior baseline referenced a matchUp from another date; the new column for
    // the same courtId holds entirely different matchUps.
    const columns = [column('c1', [pending('X')])];
    const prev = new Map([['c1', 'A']]);

    const { promotions, nextNowByCourt } = computeStripPromotions(prev, columns);
    expect(promotions).toEqual([]);
    expect(nextNowByCourt.get('c1')).toBe('X');
  });

  it('does not promote when the court has no next pending matchUp (goes free)', () => {
    const columns = [column('c1', [completed('A')])];
    const prev = new Map([['c1', 'A']]);

    const { promotions, nextNowByCourt } = computeStripPromotions(prev, columns);
    expect(promotions).toEqual([]);
    expect(nextNowByCourt.has('c1')).toBe(false);
  });

  it('promotes independently across multiple courts in one pass', () => {
    const columns = [
      column('c1', [completed('A1'), pending('B1')]),
      column('c2', [inProgress('A2'), pending('B2')]), // still live — no promotion
      column('c3', [completed('A3'), pending('B3')]),
    ];
    const prev = new Map([
      ['c1', 'A1'],
      ['c2', 'A2'],
      ['c3', 'A3'],
    ]);

    const { promotions } = computeStripPromotions(prev, columns);
    expect(promotions).toEqual([
      { matchUpId: 'B1', drawId: 'draw' },
      { matchUpId: 'B3', drawId: 'draw' },
    ]);
  });

  it('is idempotent once the promoted matchUp is the stable Now occupant', () => {
    // Second pass after a promotion: B is still the Now cell and the baseline
    // already records B — no repeat stamp.
    const columns = [column('c1', [completed('A'), pending('B')])];
    const prev = new Map([['c1', 'B']]);

    const { promotions } = computeStripPromotions(prev, columns);
    expect(promotions).toEqual([]);
  });
});
