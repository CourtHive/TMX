/**
 * Tests for validateSetScores with timed formats (SET3X-S:T10)
 * Verifies that dynamicSets properly calculates winningSide for timed sets
 */
import { describe, it, expect } from 'vitest';
import { validateSetScores } from '../scoreValidator';

describe('validateSetScores - Timed formats', () => {
  describe('SET3X-S:T10 (3 timed sets exactly, to 10 points)', () => {
    it('should calculate winningSide correctly for 10-0 0-1 0-1 (side 2 wins)', () => {
      const sets = [
        { side1: 10, side2: 0 }, // Set 1: side 1 wins
        { side1: 0, side2: 1 },  // Set 2: side 2 wins
        { side1: 0, side2: 1 },  // Set 3: side 2 wins
      ];

      const result = validateSetScores(sets, 'SET3X-S:T10', false);

      expect(result.isValid).toBe(true);
      expect(result.winningSide).toBe(2); // Side 2 won 2 out of 3 sets
      expect(result.sets?.length).toBe(3);
      expect(result.matchUpStatus).toBe('COMPLETED');
    });

    it('should calculate winningSide correctly for 10-5 10-3 0-1 (side 1 wins)', () => {
      const sets = [
        { side1: 10, side2: 5 },  // Set 1: side 1 wins
        { side1: 10, side2: 3 },  // Set 2: side 1 wins
        { side1: 0, side2: 1 },   // Set 3: side 2 wins
      ];

      const result = validateSetScores(sets, 'SET3X-S:T10', false);

      expect(result.isValid).toBe(true);
      expect(result.winningSide).toBe(1); // Side 1 won 2 out of 3 sets
      expect(result.matchUpStatus).toBe('COMPLETED');
    });

    it('should handle incomplete match (only 2 sets entered)', () => {
      const sets = [
        { side1: 10, side2: 0 },
        { side1: 0, side2: 1 },
      ];

      const result = validateSetScores(sets, 'SET3X-S:T10', false);

      // Should be invalid - not enough sets for exactly format
      expect(result.isValid).toBe(false);
    });

    it('should allow incomplete match with allowIncomplete=true', () => {
      const sets = [
        { side1: 10, side2: 0 }, // Complete set but incomplete match (need 3 sets)
      ];

      const result = validateSetScores(sets, 'SET3X-S:T10', true);

      // allowIncomplete doesn't help here - still need correct number of sets for exactly format
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Incomplete match');
    });
  });

  describe('SET3X-S:T10A (timed aggregate scoring)', () => {
    it('should calculate winningSide by aggregate score', () => {
      const sets = [
        { side1: 30, side2: 1 },  // +29 for side 1
        { side1: 0, side2: 1 },   // +1 for side 2
        { side1: 0, side2: 1 },   // +1 for side 2
      ];

      const result = validateSetScores(sets, 'SET3X-S:T10A', false);

      expect(result.isValid).toBe(true);
      expect(result.winningSide).toBe(1); // Aggregate: 30-3, side 1 wins
      expect(result.matchUpStatus).toBe('COMPLETED');
    });

    it('should handle aggregate tie resolved by TB1', () => {
      const sets = [
        { side1: 30, side2: 25 },  // +5 for side 1
        { side1: 25, side2: 30 },  // +5 for side 2
        { side1TiebreakScore: 1, side2TiebreakScore: 0 }, // TB: side 1 wins
      ];

      const result = validateSetScores(sets, 'SET3X-S:T10A-F:TB1', false);

      expect(result.isValid).toBe(true);
      expect(result.winningSide).toBe(1); // Aggregate 55-55, TB resolves to side 1
      expect(result.matchUpStatus).toBe('COMPLETED');
    });
  });

  describe('Scorestring generation', () => {
    it('should generate correct scoreString for timed sets', () => {
      const sets = [
        { side1: 10, side2: 0 },
        { side1: 0, side2: 1 },
        { side1: 0, side2: 1 },
      ];

      const result = validateSetScores(sets, 'SET3X-S:T10', false);

      expect(result.score).toBe('10-0 0-1 0-1');
    });

    it('should generate scoreString with bracket notation for TB', () => {
      const sets = [
        { side1: 30, side2: 25 },
        { side1: 25, side2: 30 },
        { side1TiebreakScore: 1, side2TiebreakScore: 0 },
      ];

      const result = validateSetScores(sets, 'SET3X-S:T10A-F:TB1', false);

      expect(result.score).toBe('30-25 25-30 [1-0]');
    });
  });
});
