import { getQualifyingOverfill } from './qualifyingDrawSize';
import { describe, expect, it } from 'vitest';

const entries = (count: number, prefix = 'p') =>
  Array.from({ length: count }, (_, i) => ({ participantId: `${prefix}${i}` }));

describe('getQualifyingOverfill', () => {
  it('blocks 12 qualifying entries into an 8 draw', () => {
    expect(getQualifyingOverfill({ stageEntries: entries(12), drawSize: 8 })).toEqual({
      entriesCount: 12,
      drawSize: 8,
    });
  });

  it('allows an exact fit and a draw with open positions', () => {
    expect(getQualifyingOverfill({ stageEntries: entries(8), drawSize: 8 })).toBeUndefined();
    expect(getQualifyingOverfill({ stageEntries: entries(12), drawSize: 16 })).toBeUndefined();
  });

  it('allows a qualifying draw defined before any entries exist', () => {
    expect(getQualifyingOverfill({ stageEntries: [], drawSize: 16 })).toBeUndefined();
  });

  it('does not count entries already placed in a qualifying that feeds the same draw', () => {
    const placed = entries(16);
    const stageEntries = [...placed, ...entries(4, 'new')];
    expect(getQualifyingOverfill({ existingEntries: placed, stageEntries, drawSize: 8 })).toBeUndefined();
    expect(getQualifyingOverfill({ existingEntries: placed, stageEntries, drawSize: 2 })).toEqual({
      entriesCount: 4,
      drawSize: 2,
    });
  });
});
