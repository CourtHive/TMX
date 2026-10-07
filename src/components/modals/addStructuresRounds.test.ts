import { ALL_ROUNDS, collectRoundLimits, naturalRounds, roundOptions, roundsField } from './addStructuresRounds';
import { describe, expect, it } from 'vitest';

const range = (roundNumber: number, count: number) => ({
  finishingPositions: Array.from({ length: count }, (_, i) => i + 1),
  finishingPositionRange: `r${roundNumber}`,
  roundNumber,
});

describe('addStructuresRounds', () => {
  it('knows how many rounds a playoff plays to one winner', () => {
    expect(naturalRounds(32)).toBe(5);
    expect(naturalRounds(16)).toBe(4);
    expect(naturalRounds(2)).toBe(1);
    expect(naturalRounds(1)).toBe(0);
    expect(naturalRounds(12)).toBe(4); // a non-power-of-two plays through the next power
  });

  it('offers All and every cap below the natural depth, nothing for a one-round structure', () => {
    expect(roundOptions(32, 'All').map((o) => o.value)).toEqual([ALL_ROUNDS, '1', '2', '3', '4']);
    expect(roundOptions(32, 'All')[0]).toEqual({ label: 'All', value: ALL_ROUNDS, selected: true });
    expect(roundOptions(2, 'All').map((o) => o.value)).toEqual([ALL_ROUNDS]);
  });

  it('collects caps keyed by source round, ignoring All, out-of-range and unchecked ranges', () => {
    const values: Record<string, string> = {
      [roundsField('r1')]: '2',
      [roundsField('r2')]: ALL_ROUNDS,
      [roundsField('r3')]: '9', // at or beyond the natural depth is no cap
      [roundsField('r4')]: '1', // not checked: not collected
    };
    const read = (field: string) => values[field];
    expect(collectRoundLimits([range(1, 32), range(2, 16), range(3, 8)], read)).toEqual({ 1: 2 });
    expect(collectRoundLimits([range(2, 16)], read)).toBeUndefined();
    expect(collectRoundLimits([], read)).toBeUndefined();
  });
});
