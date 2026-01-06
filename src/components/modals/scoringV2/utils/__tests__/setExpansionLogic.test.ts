/**
 * Test suite for set expansion logic
 * 
 * Tests the logic that determines when to expand set inputs in dynamicSets approach.
 * Critical for proper match progression and winner determination.
 */

import { describe, it, expect } from 'vitest';
import {
  parseMatchUpFormat,
  shouldExpandSets,
  determineWinningSide,
} from '../setExpansionLogic';
import type { SetScore } from '../../types';

describe('setExpansionLogic', () => {
  describe('parseMatchUpFormat', () => {
    it('should parse SET3 format', () => {
      const result = parseMatchUpFormat('SET3-S:6/TB7');
      expect(result).toEqual({ bestOf: 3, setsToWin: 2 });
    });

    it('should parse SET5 format', () => {
      const result = parseMatchUpFormat('SET5-S:6/TB7');
      expect(result).toEqual({ bestOf: 5, setsToWin: 3 });
    });

    it('should parse SET1 format', () => {
      const result = parseMatchUpFormat('SET1-S:TB10');
      expect(result).toEqual({ bestOf: 1, setsToWin: 1 });
    });

    it('should default to SET3 when no format provided', () => {
      const result = parseMatchUpFormat();
      expect(result).toEqual({ bestOf: 3, setsToWin: 2 });
    });

    it('should default to SET3 when format has no SET number', () => {
      const result = parseMatchUpFormat('S:6/TB7');
      expect(result).toEqual({ bestOf: 3, setsToWin: 2 });
    });

    it('should parse complex format with finalSetFormat', () => {
      const result = parseMatchUpFormat('SET3-S:6/TB7-F:TB10');
      expect(result).toEqual({ bestOf: 3, setsToWin: 2 });
    });

    it('should parse SET7 format (hypothetical)', () => {
      const result = parseMatchUpFormat('SET7-S:6/TB7');
      expect(result).toEqual({ bestOf: 7, setsToWin: 4 });
    });
  });

  describe('shouldExpandSets', () => {
    describe('Basic Expansion Logic', () => {
      it('should expand when no sets exist (initial state)', () => {
        const sets: SetScore[] = [];
        const result = shouldExpandSets(sets, 'SET3-S:6/TB7');
        expect(result).toBe(true);
      });

      it('should expand after first set is complete', () => {
        const sets: SetScore[] = [
          { side1Score: 6, side2Score: 4 },
        ];
        const result = shouldExpandSets(sets, 'SET3-S:6/TB7');
        expect(result).toBe(true);
      });

      it('should expand after two sets when tied 1-1', () => {
        const sets: SetScore[] = [
          { side1Score: 6, side2Score: 4 },
          { side1Score: 4, side2Score: 6 },
        ];
        const result = shouldExpandSets(sets, 'SET3-S:6/TB7');
        expect(result).toBe(true);
      });

      it('should NOT expand when match is complete (2-0)', () => {
        const sets: SetScore[] = [
          { side1Score: 6, side2Score: 4 },
          { side1Score: 6, side2Score: 3 },
        ];
        const result = shouldExpandSets(sets, 'SET3-S:6/TB7');
        expect(result).toBe(false);
      });

      it('should NOT expand when match is complete (2-1)', () => {
        const sets: SetScore[] = [
          { side1Score: 6, side2Score: 4 },
          { side1Score: 4, side2Score: 6 },
          { side1Score: 6, side2Score: 3 },
        ];
        const result = shouldExpandSets(sets, 'SET3-S:6/TB7');
        expect(result).toBe(false);
      });

      it('should NOT expand beyond bestOf limit', () => {
        const sets: SetScore[] = [
          { side1Score: 6, side2Score: 4 },
          { side1Score: 4, side2Score: 6 },
          { side1Score: 3, side2Score: 4 },
        ];
        const result = shouldExpandSets(sets, 'SET3-S:6/TB7');
        expect(result).toBe(false); // Already at 3 sets (bestOf)
      });
    });

    describe('Incomplete Sets', () => {
      it('should NOT expand when current set is incomplete', () => {
        const sets: SetScore[] = [
          { side1Score: 6, side2Score: 4 },
          { side1Score: 3, side2Score: undefined },
        ];
        const result = shouldExpandSets(sets, 'SET3-S:6/TB7');
        expect(result).toBe(false);
      });

      it('should NOT expand when side1Score is null', () => {
        const sets: SetScore[] = [
          { side1Score: 6, side2Score: 4 },
          { side1Score: null as any, side2Score: 4 },
        ];
        const result = shouldExpandSets(sets, 'SET3-S:6/TB7');
        expect(result).toBe(false);
      });

      it('should NOT expand when side2Score is null', () => {
        const sets: SetScore[] = [
          { side1Score: 6, side2Score: 4 },
          { side1Score: 4, side2Score: null as any },
        ];
        const result = shouldExpandSets(sets, 'SET3-S:6/TB7');
        expect(result).toBe(false);
      });

      it('should NOT expand when both scores are undefined', () => {
        const sets: SetScore[] = [
          { side1Score: 6, side2Score: 4 },
          { side1Score: undefined, side2Score: undefined },
        ];
        const result = shouldExpandSets(sets, 'SET3-S:6/TB7');
        expect(result).toBe(false);
      });
    });

    describe('Best-of-5 Matches', () => {
      it('should expand after 1-0 in best-of-5', () => {
        const sets: SetScore[] = [
          { side1Score: 6, side2Score: 4 },
        ];
        const result = shouldExpandSets(sets, 'SET5-S:6/TB7');
        expect(result).toBe(true);
      });

      it('should expand after 1-1 in best-of-5', () => {
        const sets: SetScore[] = [
          { side1Score: 6, side2Score: 4 },
          { side1Score: 4, side2Score: 6 },
        ];
        const result = shouldExpandSets(sets, 'SET5-S:6/TB7');
        expect(result).toBe(true);
      });

      it('should expand after 2-1 in best-of-5', () => {
        const sets: SetScore[] = [
          { side1Score: 6, side2Score: 4 },
          { side1Score: 4, side2Score: 6 },
          { side1Score: 6, side2Score: 3 },
        ];
        const result = shouldExpandSets(sets, 'SET5-S:6/TB7');
        expect(result).toBe(true);
      });

      it('should expand after 2-2 in best-of-5', () => {
        const sets: SetScore[] = [
          { side1Score: 6, side2Score: 4 },
          { side1Score: 4, side2Score: 6 },
          { side1Score: 6, side2Score: 3 },
          { side1Score: 3, side2Score: 6 },
        ];
        const result = shouldExpandSets(sets, 'SET5-S:6/TB7');
        expect(result).toBe(true);
      });

      it('should NOT expand after 3-0 in best-of-5', () => {
        const sets: SetScore[] = [
          { side1Score: 6, side2Score: 4 },
          { side1Score: 6, side2Score: 3 },
          { side1Score: 6, side2Score: 2 },
        ];
        const result = shouldExpandSets(sets, 'SET5-S:6/TB7');
        expect(result).toBe(false);
      });

      it('should NOT expand after 3-2 in best-of-5', () => {
        const sets: SetScore[] = [
          { side1Score: 6, side2Score: 4 },
          { side1Score: 4, side2Score: 6 },
          { side1Score: 6, side2Score: 3 },
          { side1Score: 3, side2Score: 6 },
          { side1Score: 6, side2Score: 4 },
        ];
        const result = shouldExpandSets(sets, 'SET5-S:6/TB7');
        expect(result).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty sets array', () => {
        const sets: SetScore[] = [];
        const result = shouldExpandSets(sets);
        expect(result).toBe(true);
      });

      it('should handle null sets', () => {
        const result = shouldExpandSets(null as any);
        expect(result).toBe(true);
      });

      it('should handle undefined sets', () => {
        const result = shouldExpandSets(undefined as any);
        expect(result).toBe(true);
      });

      it('should handle 0-0 scores as complete', () => {
        const sets: SetScore[] = [
          { side1Score: 0, side2Score: 0 },
        ];
        const result = shouldExpandSets(sets, 'SET3-S:6/TB7');
        expect(result).toBe(true); // 0-0 is technically complete (both filled)
      });
    });
  });

  describe('determineWinningSide', () => {
    describe('Best-of-3 Winner Detection', () => {
      it('should determine side1 wins 2-0', () => {
        const sets: SetScore[] = [
          { side1Score: 6, side2Score: 4 },
          { side1Score: 6, side2Score: 3 },
        ];
        const result = determineWinningSide(sets, 'SET3-S:6/TB7');
        expect(result).toBe(1);
      });

      it('should determine side2 wins 2-0', () => {
        const sets: SetScore[] = [
          { side1Score: 4, side2Score: 6 },
          { side1Score: 3, side2Score: 6 },
        ];
        const result = determineWinningSide(sets, 'SET3-S:6/TB7');
        expect(result).toBe(2);
      });

      it('should determine side1 wins 2-1', () => {
        const sets: SetScore[] = [
          { side1Score: 6, side2Score: 4 },
          { side1Score: 4, side2Score: 6 },
          { side1Score: 6, side2Score: 3 },
        ];
        const result = determineWinningSide(sets, 'SET3-S:6/TB7');
        expect(result).toBe(1);
      });

      it('should determine side2 wins 2-1', () => {
        const sets: SetScore[] = [
          { side1Score: 4, side2Score: 6 },
          { side1Score: 6, side2Score: 4 },
          { side1Score: 3, side2Score: 6 },
        ];
        const result = determineWinningSide(sets, 'SET3-S:6/TB7');
        expect(result).toBe(2);
      });

      it('should return undefined when tied 1-1', () => {
        const sets: SetScore[] = [
          { side1Score: 6, side2Score: 4 },
          { side1Score: 4, side2Score: 6 },
        ];
        const result = determineWinningSide(sets, 'SET3-S:6/TB7');
        expect(result).toBeUndefined();
      });

      it('should return undefined after only 1 set', () => {
        const sets: SetScore[] = [
          { side1Score: 6, side2Score: 4 },
        ];
        const result = determineWinningSide(sets, 'SET3-S:6/TB7');
        expect(result).toBeUndefined();
      });
    });

    describe('Best-of-5 Winner Detection', () => {
      it('should determine side1 wins 3-0', () => {
        const sets: SetScore[] = [
          { side1Score: 6, side2Score: 4 },
          { side1Score: 6, side2Score: 3 },
          { side1Score: 6, side2Score: 2 },
        ];
        const result = determineWinningSide(sets, 'SET5-S:6/TB7');
        expect(result).toBe(1);
      });

      it('should determine side2 wins 3-1', () => {
        const sets: SetScore[] = [
          { side1Score: 6, side2Score: 4 },
          { side1Score: 4, side2Score: 6 },
          { side1Score: 3, side2Score: 6 },
          { side1Score: 2, side2Score: 6 },
        ];
        const result = determineWinningSide(sets, 'SET5-S:6/TB7');
        expect(result).toBe(2);
      });

      it('should determine side1 wins 3-2', () => {
        const sets: SetScore[] = [
          { side1Score: 6, side2Score: 4 },
          { side1Score: 4, side2Score: 6 },
          { side1Score: 6, side2Score: 3 },
          { side1Score: 3, side2Score: 6 },
          { side1Score: 6, side2Score: 4 },
        ];
        const result = determineWinningSide(sets, 'SET5-S:6/TB7');
        expect(result).toBe(1);
      });

      it('should return undefined when tied 2-2', () => {
        const sets: SetScore[] = [
          { side1Score: 6, side2Score: 4 },
          { side1Score: 4, side2Score: 6 },
          { side1Score: 6, side2Score: 3 },
          { side1Score: 3, side2Score: 6 },
        ];
        const result = determineWinningSide(sets, 'SET5-S:6/TB7');
        expect(result).toBeUndefined();
      });

      it('should return undefined when leading 2-1', () => {
        const sets: SetScore[] = [
          { side1Score: 6, side2Score: 4 },
          { side1Score: 4, side2Score: 6 },
          { side1Score: 6, side2Score: 3 },
        ];
        const result = determineWinningSide(sets, 'SET5-S:6/TB7');
        expect(result).toBeUndefined();
      });
    });

    describe('Tiebreak Sets', () => {
      it('should determine winner with tiebreak set', () => {
        const sets: SetScore[] = [
          { side1Score: 7, side2Score: 6 }, // side1 wins with tiebreak
          { side1Score: 6, side2Score: 3 },
        ];
        const result = determineWinningSide(sets, 'SET3-S:6/TB7');
        expect(result).toBe(1);
      });

      it('should handle extended set scores', () => {
        const sets: SetScore[] = [
          { side1Score: 8, side2Score: 6 }, // side1 wins extended
          { side1Score: 3, side2Score: 6 },
          { side1Score: 7, side2Score: 5 },
        ];
        const result = determineWinningSide(sets, 'SET3-S:8/TB7');
        expect(result).toBe(1);
      });
    });

    describe('Edge Cases', () => {
      it('should return undefined for empty sets', () => {
        const sets: SetScore[] = [];
        const result = determineWinningSide(sets, 'SET3-S:6/TB7');
        expect(result).toBeUndefined();
      });

      it('should return undefined for null sets', () => {
        const result = determineWinningSide(null as any, 'SET3-S:6/TB7');
        expect(result).toBeUndefined();
      });

      it('should return undefined for undefined sets', () => {
        const result = determineWinningSide(undefined as any, 'SET3-S:6/TB7');
        expect(result).toBeUndefined();
      });

      it('should handle tied sets (should not happen but test anyway)', () => {
        const sets: SetScore[] = [
          { side1Score: 6, side2Score: 6 }, // Invalid but test handling
        ];
        const result = determineWinningSide(sets, 'SET3-S:6/TB7');
        expect(result).toBeUndefined(); // No winner
      });

      it('should handle 0-0 scores', () => {
        const sets: SetScore[] = [
          { side1Score: 0, side2Score: 0 },
        ];
        const result = determineWinningSide(sets, 'SET3-S:6/TB7');
        expect(result).toBeUndefined(); // No winner in tied sets
      });

      it('should handle sets with undefined scores', () => {
        const sets: SetScore[] = [
          { side1Score: undefined, side2Score: undefined },
          { side1Score: 6, side2Score: 4 },
        ];
        const result = determineWinningSide(sets, 'SET3-S:6/TB7');
        expect(result).toBeUndefined(); // Only 1 complete set
      });

      it('should handle null scores as 0', () => {
        const sets: SetScore[] = [
          { side1Score: 6, side2Score: null as any },
          { side1Score: 6, side2Score: null as any },
        ];
        const result = determineWinningSide(sets, 'SET3-S:6/TB7');
        expect(result).toBe(1); // side1 wins 2-0 (treating null as 0)
      });
    });

    describe('Best-of-1 (Tiebreak Match)', () => {
      it('should determine winner in best-of-1', () => {
        const sets: SetScore[] = [
          { side1Score: 10, side2Score: 8 },
        ];
        const result = determineWinningSide(sets, 'SET1-S:TB10');
        expect(result).toBe(1);
      });

      it('should return undefined for incomplete best-of-1', () => {
        const sets: SetScore[] = [];
        const result = determineWinningSide(sets, 'SET1-S:TB10');
        expect(result).toBeUndefined();
      });
    });
  });
});
