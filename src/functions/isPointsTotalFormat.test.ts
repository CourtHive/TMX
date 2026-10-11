import { isPointsTotalFormat } from './isPointsTotalFormat';
import { describe, expect, it } from 'vitest';

describe('isPointsTotalFormat', () => {
  it('a combined-point total, with or without a tie rule', () => {
    for (const code of ['SET1-S:P32', 'SET1-S:P32DP', 'SET1-S:P32WB2', 'SET1-S:P24']) {
      expect(isPointsTotalFormat(code), code).toBe(true);
    }
  });

  it('control: games-based, timed and tiebreak-only formats, and none', () => {
    for (const code of ['SET3-S:6/TB7', 'SET3-S:T10P', 'SET1-S:TB10', 'INN9-S:O3', '', undefined]) {
      expect(isPointsTotalFormat(code), String(code)).toBe(false);
    }
  });
});
