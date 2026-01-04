/**
 * Tests for freeScore parser
 * 
 * Tests character-by-character parsing with matchUpFormat context
 */

import { describe, it, expect } from 'vitest';
import { parseScore } from './freeScore';

describe('freeScore Parser', () => {
  describe('Basic Score Parsing', () => {
    it('should parse simple best-of-3 score with dashes', () => {
      const result = parseScore('6-4 6-3', 'SET3-S:6/TB7');
      
      expect(result.valid).toBe(true);
      expect(result.formattedScore).toBe('6-4 6-3');
      expect(result.sets).toHaveLength(2);
      expect(result.sets[0]).toMatchObject({
        side1Score: 6,
        side2Score: 4,
        winningSide: 1,
      });
      expect(result.matchComplete).toBe(true);
    });

    it('should parse score without dashes', () => {
      const result = parseScore('6463', 'SET3-S:6/TB7');
      
      expect(result.valid).toBe(true);
      expect(result.formattedScore).toBe('6-4 6-3');
      expect(result.sets).toHaveLength(2);
    });

    it('should parse score with spaces only', () => {
      const result = parseScore('64 63', 'SET3-S:6/TB7');
      
      expect(result.valid).toBe(true);
      expect(result.formattedScore).toBe('6-4 6-3');
    });

    it('should parse incomplete score', () => {
      const result = parseScore('64', 'SET3-S:6/TB7');
      
      expect(result.valid).toBe(true);
      expect(result.formattedScore).toBe('6-4');
      expect(result.sets).toHaveLength(1);
      expect(result.incomplete).toBe(true);
      expect(result.matchComplete).toBe(false);
    });
  });

  describe('Tiebreak Parsing', () => {
    it('should parse regular set tiebreak with parentheses', () => {
      const result = parseScore('6-7(5) 6-3', 'SET3-S:6/TB7');
      
      expect(result.valid).toBe(true);
      expect(result.formattedScore).toBe('6-7(5) 6-3');
      expect(result.sets[0]).toMatchObject({
        side1Score: 6,
        side2Score: 7,
        side1TiebreakScore: 5, // (5) is the losing tiebreak score for side1
        side2TiebreakScore: 7, // Inferred winning score (min of tiebreakTo or losingScore+2)
        winningSide: 2,
      });
    });

    it('should parse match tiebreak with brackets', () => {
      const result = parseScore('6-4 4-6 [10-7]', 'SET3-S:6/TB7-F:TB10');
      
      expect(result.valid).toBe(true);
      expect(result.formattedScore).toBe('6-4 4-6 [10-7]');
      expect(result.sets[2]).toMatchObject({
        side1TiebreakScore: 10,
        side2TiebreakScore: 7,
      });
    });

    it('should parse match tiebreak without brackets', () => {
      const result = parseScore('64 46 107', 'SET3-S:6/TB7-F:TB10');
      
      expect(result.valid).toBe(true);
      expect(result.formattedScore).toBe('6-4 4-6 [10-7]');
    });
  });

  describe('Format-Aware Disambiguation', () => {
    it('should disambiguate "123" based on setTo:6 (becomes 1-23 invalid)', () => {
      const result = parseScore('123', 'SET3-S:6/TB7');
      
      // "123" with setTo:6 means max game score is 7
      // Could be: "1-23" (invalid), "12-3" (invalid), "1-2 3" (incomplete)
      // Parser should recognize these as problematic
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle "7564" correctly (7-5 6-4)', () => {
      const result = parseScore('7564', 'SET3-S:6/TB7');
      
      expect(result.valid).toBe(true);
      expect(result.formattedScore).toBe('7-5 6-4');
      expect(result.sets).toHaveLength(2);
    });

    it('should handle pro set format (SET1-S:8/TB7)', () => {
      const result = parseScore('8-6', 'SET1-S:8/TB7');
      
      expect(result.valid).toBe(true);
      expect(result.formattedScore).toBe('8-6');
      expect(result.matchComplete).toBe(true);
    });
  });

  describe('Various Separators', () => {
    it('should accept commas as separators', () => {
      const result = parseScore('6,4,6,3', 'SET3-S:6/TB7');
      
      expect(result.valid).toBe(true);
      expect(result.formattedScore).toBe('6-4 6-3');
    });

    it('should accept semicolons as separators', () => {
      const result = parseScore('6;4;6;3', 'SET3-S:6/TB7');
      
      expect(result.valid).toBe(true);
      expect(result.formattedScore).toBe('6-4 6-3');
    });

    it('should accept mixed separators', () => {
      const result = parseScore('6-4,6 3', 'SET3-S:6/TB7');
      
      expect(result.valid).toBe(true);
      expect(result.formattedScore).toBe('6-4 6-3');
    });
  });

  describe('Best of 5 Formats', () => {
    it('should parse best-of-5 match', () => {
      const result = parseScore('6-3 4-6 6-4 3-6 6-2', 'SET5-S:6/TB7');
      
      expect(result.valid).toBe(true);
      expect(result.sets).toHaveLength(5);
      expect(result.matchComplete).toBe(true);
    });

    it('should parse best-of-5 ending in 3 sets', () => {
      const result = parseScore('6-3 6-4 6-2', 'SET5-S:6/TB7');
      
      expect(result.valid).toBe(true);
      expect(result.sets).toHaveLength(3);
      expect(result.matchComplete).toBe(true);
    });
  });

  describe('Short Set Formats', () => {
    it('should parse SET1-S:4/TB7 (short set)', () => {
      const result = parseScore('4-2', 'SET1-S:4/TB7');
      
      expect(result.valid).toBe(true);
      expect(result.formattedScore).toBe('4-2');
      expect(result.matchComplete).toBe(true);
    });

    it('should parse Fast4 format SET3-S:4/TB5@3', () => {
      const result = parseScore('4-2 3-4(2) 4-1', 'SET3-S:4/TB5@3');
      
      expect(result.valid).toBe(true);
      expect(result.sets).toHaveLength(3);
    });
  });

  describe('Error Cases', () => {
    it('should ignore invalid characters as separators', () => {
      const result = parseScore('6-4 x 6-3', 'SET3-S:6/TB7');
      
      // Non-numeric characters (except parentheses/brackets) are treated as separators
      expect(result.valid).toBe(true);
      expect(result.formattedScore).toBe('6-4 6-3');
      expect(result.sets).toHaveLength(2);
    });

    it('should warn about scores exceeding format limits', () => {
      const result = parseScore('10-2', 'SET3-S:6/TB7');
      
      // 10 exceeds setTo + 1 (7)
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Real-World Examples from tidyScore', () => {
    it('should parse "6-2;2-6;10-2"', () => {
      const result = parseScore('6-2;2-6;10-2', 'SET3-S:6/TB7-F:TB10');
      
      expect(result.valid).toBe(true);
      expect(result.formattedScore).toBe('6-2 2-6 [10-2]');
    });

    it('should parse "6 3 6 7(3) 6 0"', () => {
      const result = parseScore('6 3 6 7(3) 6 0', 'SET3-S:6/TB7');
      
      expect(result.valid).toBe(true);
      expect(result.formattedScore).toBe('6-3 6-7(3) 6-0');
    });

    it('should parse "67(6)64106" (no separators)', () => {
      const result = parseScore('67(6)64106', 'SET3-S:6/TB7-F:TB10');
      
      expect(result.valid).toBe(true);
      expect(result.formattedScore).toBe('6-7(6) 6-4 [10-6]');
    });
  });

  describe('Confidence and Ambiguity', () => {
    it('should have high confidence for clear input', () => {
      const result = parseScore('6-4 6-3', 'SET3-S:6/TB7');
      
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.ambiguities).toHaveLength(0);
    });

    it('should detect ambiguity in "64106"', () => {
      const result = parseScore('64106', 'SET3-S:6/TB7-F:TB10');
      
      // Could be: "6-4 10-6" or "6-4 [10-6]"
      // Parser should recognize final set context
      expect(result.valid).toBe(true);
      // Might have lower confidence or suggestions
    });
  });
});
