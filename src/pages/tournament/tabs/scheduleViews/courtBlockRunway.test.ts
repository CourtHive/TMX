import { courtBlockSignal, formatRunway } from './courtBlockRunway';
import { describe, expect, it } from 'vitest';

// constants and types
import type { CourtBlockWindow } from './courtBlockRunway';

const COURT = 'c1';
const AVERAGE = 90;
const NOW = 14 * 60; // 14:00

const block = (over: Partial<CourtBlockWindow> = {}): CourtBlockWindow => ({
  courtId: COURT,
  type: 'MAINTENANCE',
  startMinutes: 15 * 60,
  endMinutes: 16 * 60,
  ...over,
});

const idle = (blocks: CourtBlockWindow[]) => ({ courtId: COURT, nowMinutes: NOW, blocks, averageMinutes: AVERAGE });
const busy = (blocks: CourtBlockWindow[], occupiedUntilMinutes: number) => ({ ...idle(blocks), occupiedUntilMinutes });

describe('courtBlockSignal — an idle court', () => {
  it('counts down once a typical match no longer fits', () => {
    // 14:00 now, maintenance at 15:00, a match costs 90 — 60 minutes left is not
    // enough, so the figure appears. Its appearance IS the signal.
    expect(courtBlockSignal(idle([block()]))).toEqual({ kind: 'runway', type: 'MAINTENANCE', minutes: 60 });
  });

  it('stays silent while a match still fits — the control', () => {
    // Same court, block pushed to 16:00: 120 minutes is room enough, so nothing
    // is said. Without this the figure would be furniture from breakfast onward.
    expect(courtBlockSignal(idle([block({ startMinutes: 16 * 60 })]))).toBeUndefined();
  });

  it('is silent at exactly the average — a match that just fits, fits', () => {
    expect(courtBlockSignal(idle([block({ startMinutes: NOW + AVERAGE })]))).toBeUndefined();
  });

  it('takes the earliest upcoming block when several are queued', () => {
    const blocks = [block({ startMinutes: 17 * 60, type: 'PRACTICE' }), block({ startMinutes: 14 * 60 + 30 })];
    expect(courtBlockSignal(idle(blocks))).toEqual({ kind: 'runway', type: 'MAINTENANCE', minutes: 30 });
  });

  it('says nothing when there is no upcoming block at all', () => {
    expect(courtBlockSignal(idle([]))).toBeUndefined();
  });

  it('ignores a block that has already finished', () => {
    expect(courtBlockSignal(idle([block({ startMinutes: 9 * 60, endMinutes: 10 * 60 })]))).toBeUndefined();
  });

  it('ignores another court entirely', () => {
    expect(courtBlockSignal(idle([block({ courtId: 'c2', startMinutes: 14 * 60 + 10 })]))).toBeUndefined();
  });

  it('defers to the banner while a block is in force', () => {
    // Counting down to the NEXT block, behind one already running, answers a
    // question nobody has yet.
    const blocks = [block({ startMinutes: 13 * 60, endMinutes: 15 * 60 }), block({ startMinutes: 15 * 60 + 30 })];
    expect(courtBlockSignal(idle(blocks))).toBeUndefined();
  });
});

describe('courtBlockSignal — an occupied court', () => {
  it('marks the cell when the block arrives before the match is expected to end', () => {
    // Match runs to 15:30, maintenance at 15:00 — it will be interrupted.
    expect(courtBlockSignal(busy([block()], 15 * 60 + 30))).toEqual({
      kind: 'edge',
      type: 'MAINTENANCE',
      minutes: 60,
    });
  });

  it('says nothing when the match finishes first — the control', () => {
    expect(courtBlockSignal(busy([block()], 14 * 60 + 45))).toBeUndefined();
  });

  it('says nothing when the block starts exactly as the match is due to end', () => {
    expect(courtBlockSignal(busy([block()], 15 * 60))).toBeUndefined();
  });

  it('never returns a runway for an occupied court — the shapes do not mix', () => {
    // A duration is the idle court's answer; an occupied court has already been
    // answered, so the only thing left to say is "this will be interrupted".
    const signal = courtBlockSignal(busy([block({ startMinutes: 14 * 60 + 10 })], 16 * 60));
    expect(signal?.kind).toBe('edge');
  });
});

describe('formatRunway', () => {
  it('reads as minutes under an hour', () => {
    expect(formatRunway(40)).toBe('40m');
    expect(formatRunway(0)).toBe('0m');
  });

  it('reads as hours and padded minutes at or over an hour', () => {
    expect(formatRunway(60)).toBe('1h 00m');
    expect(formatRunway(125)).toBe('2h 05m');
  });

  it('never reports a negative runway', () => {
    expect(formatRunway(-5)).toBe('0m');
  });
});
