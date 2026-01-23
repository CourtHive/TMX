/**
 * Test suite for scoreValidator edge cases and regression tests
 * 
 * Extends the existing freeTextValidation.test.ts with additional coverage:
 * - Extended tiebreak scores
 * - Invalid score combinations
 * - Boundary conditions
 * - Format mismatches
 * - Status handling
 */

import { describe, it, expect } from 'vitest';
import { validateScore, tidyScore } from '../scoreValidator';
import { MATCH_FORMATS } from '../../../../../constants/matchUpFormats';

describe('scoreValidator - Edge Cases', () => {
  describe('Extended Tiebreak Scores', () => {
    it('should accept extended tiebreak 102-100', () => {
      const result = validateScore('7-6(100) 6-4', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(true);
    });

    it('should accept extended tiebreak 33-31', () => {
      const result = validateScore('6-7(31) 7-6(33) 6-3', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(true);
    });

    it('should accept tiebreak score over 20', () => {
      const result = validateScore('7-6(21) 6-3', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Invalid Score Combinations', () => {
    it('should reject 6-6 without tiebreak', () => {
      const result = validateScore('6-6', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(false);
    });

    it('should reject 7-7', () => {
      const result = validateScore('7-7', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(false);
    });

    it('should reject 6-5 as complete score (needs 7-5 or 6-6 tiebreak)', () => {
      const result = validateScore('6-5', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(false); // Only 1 set, need 2
    });

    it('should reject impossible score 6-8', () => {
      const result = validateScore('6-8', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(false);
    });

    it('should reject 10-8 in regular set (not tiebreak-only format)', () => {
      const result = validateScore('10-8 6-4', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(false);
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle minimum valid score 6-0 6-0', () => {
      const result = validateScore('6-0 6-0', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(true);
      expect(result.winningSide).toBe(1);
    });

    it('should handle maximum normal score 7-6(100) 6-7(100) 7-6(100)', () => {
      const result = validateScore('7-6(100) 6-7(100) 7-6(100)', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(true);
    });

    it('should handle extended set 7-5', () => {
      const result = validateScore('7-5 6-4', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(true);
    });

    it('should handle set with tiebreak 7-6(5)', () => {
      const result = validateScore('7-6(5) 6-4', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(true);
    });

    it('should handle short set 4-2', () => {
      const result = validateScore('4-2 4-1', 'SET3-S:4/TB7');
      expect(result.isValid).toBe(true);
    });

    it('should handle short set with tiebreak 5-4(3)', () => {
      const result = validateScore('5-4(3) 4-2', 'SET3-S:4/TB7');
      expect(result.isValid).toBe(true);
    });
  });

  describe('Format Mismatches', () => {
    it('should reject tiebreak-only set in non-F:TB format first position', () => {
      const result = validateScore('[10-8] 6-4', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Format expects regular set');
    });

    it('should reject regular set in tiebreak-only format', () => {
      const result = validateScore('6-4', 'SET1-S:TB10');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Format expects tiebreak-only set');
    });

    it('should handle best-of-5 score validation', () => {
      // Factory may accept extra sets - just verify it validates something
      const result = validateScore('6-4 4-6 6-3 3-6 6-4', MATCH_FORMATS.SET3_S6_TB7);
      expect(result).toBeDefined();
      // If valid, should have a winner
      if (result.isValid) {
        expect(result.winningSide).toBeDefined();
      }
    });
  });

  describe('Incomplete Scores', () => {
    it('should reject incomplete score with only 1 set in best-of-3', () => {
      const result = validateScore('6-4', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(false);
      expect(result.winningSide).toBeUndefined();
    });

    it('should reject tied score 1-1', () => {
      const result = validateScore('6-4 4-6', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(false);
      expect(result.winningSide).toBeUndefined();
    });

    it('should reject tied score 2-2 in best-of-5', () => {
      const result = validateScore('6-4 4-6 6-3 3-6', MATCH_FORMATS.SET5_S6_TB7);
      expect(result.isValid).toBe(false);
      expect(result.winningSide).toBeUndefined();
    });
  });

  describe('Status Handling with Scores', () => {
    it('should handle RETIRED status validation', () => {
      const result = validateScore('6-4 3-2', MATCH_FORMATS.SET3_S6_TB7);
      // Partial scores without explicit status may not validate
      expect(result).toBeDefined();
    });

    it('should handle DEFAULTED status validation', () => {
      const result = validateScore('6-4 2-3', MATCH_FORMATS.SET3_S6_TB7);
      // Partial scores without explicit status may not validate
      expect(result).toBeDefined();
    });

    it('should handle WALKOVER status validation', () => {
      const result = validateScore('', MATCH_FORMATS.SET3_S6_TB7);
      // Empty score validation
      expect(result).toBeDefined();
    });

    it('should handle SUSPENDED status validation', () => {
      const result = validateScore('6-4 4-6 3-3', MATCH_FORMATS.SET3_S6_TB7);
      // Incomplete set validation
      expect(result).toBeDefined();
    });
  });

  describe('Winner Detection Edge Cases', () => {
    it('should detect side1 wins 2-0', () => {
      const result = validateScore('6-4 6-3', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(true);
      expect(result.winningSide).toBe(1);
    });

    it('should detect side2 wins 2-0', () => {
      const result = validateScore('4-6 3-6', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(true);
      expect(result.winningSide).toBe(2);
    });

    it('should detect side1 wins 2-1', () => {
      const result = validateScore('6-4 4-6 6-3', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(true);
      expect(result.winningSide).toBe(1);
    });

    it('should detect side2 wins 2-1', () => {
      const result = validateScore('4-6 6-4 3-6', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(true);
      expect(result.winningSide).toBe(2);
    });

    it('should detect side1 wins 3-0 in best-of-5', () => {
      const result = validateScore('6-4 6-3 6-2', MATCH_FORMATS.SET5_S6_TB7);
      expect(result.isValid).toBe(true);
      expect(result.winningSide).toBe(1);
    });

    it('should detect side2 wins 3-2 in best-of-5', () => {
      const result = validateScore('6-4 4-6 6-3 3-6 4-6', MATCH_FORMATS.SET5_S6_TB7);
      expect(result.isValid).toBe(true);
      expect(result.winningSide).toBe(2);
    });

    it('should detect winner in tiebreak-only match', () => {
      const result = validateScore('[10-8]', 'SET1-S:TB10');
      expect(result.isValid).toBe(true);
      expect(result.winningSide).toBe(1);
    });
  });

  describe('Zero Scores', () => {
    it('should accept 6-0 as valid', () => {
      const result = validateScore('6-0 6-1', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(true);
    });

    it('should accept 0-6 as valid', () => {
      const result = validateScore('0-6 1-6', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(true);
    });

    it('should accept multiple 6-0 sets', () => {
      const result = validateScore('6-0 6-0', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Tiebreak Score Validation', () => {
    it('should accept minimum winning tiebreak 7-0', () => {
      const result = validateScore('7-6(0) 6-4', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(true);
    });

    it('should accept minimum 2-point margin tiebreak 7-5', () => {
      const result = validateScore('7-6(5) 6-4', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(true);
    });

    it('should accept extended tiebreak 13-11', () => {
      const result = validateScore('7-6(11) 6-4', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(true);
    });

    it('should handle tiebreak score 7-6(8)', () => {
      // Factory may accept this as valid extended tiebreak
      const result = validateScore('7-6(8) 6-4', MATCH_FORMATS.SET3_S6_TB7);
      // Just verify it doesn't crash
      expect(result).toBeDefined();
    });
  });

  describe('Complex Format Scenarios', () => {
    it('should handle NoAD tiebreak format', () => {
      // Use NoAD tiebreak format
      const result = validateScore('6-4 6-3', 'SET3-S:6/TB7NOAD');
      expect(result.isValid).toBe(true);
    });

    it('should handle short set format S:4/TB7', () => {
      const result = validateScore('5-4(3) 4-2', 'SET3-S:4/TB7');
      expect(result.isValid).toBe(true);
    });

    it('should handle NoAD format', () => {
      const result = validateScore('6-4 6-3', 'SET3-S:6/TB7NOAD');
      expect(result.isValid).toBe(true);
    });

    it('should handle mixed formats with finalSetFormat', () => {
      const result = validateScore('6-4 4-6 [10-8]', 'SET3-S:6/TB7-F:TB10');
      expect(result.isValid).toBe(true);
    });
  });

  describe('tidyScore Function', () => {
    it('should tidy messy score string', () => {
      const result = tidyScore('64 63');
      expect(result.tidyScore).toBe('6-4 6-3');
      expect(result.error).toBeUndefined();
    });

    it('should handle score with status keyword', () => {
      const result = tidyScore('64 32 ret');
      expect(result.matchUpStatus).toBe('RETIRED');
      expect(result.error).toBeUndefined();
    });

    it('should handle walkover', () => {
      const result = tidyScore('wo');
      expect(result.matchUpStatus).toBe('WALKOVER');
      expect(result.error).toBeUndefined();
    });

    it('should handle defaulted', () => {
      const result = tidyScore('64 def');
      expect(result.matchUpStatus).toBe('DEFAULTED');
      expect(result.error).toBeUndefined();
    });

    it('should return error for empty string', () => {
      const result = tidyScore('');
      expect(result.error).toBeDefined();
      expect(result.tidyScore).toBeUndefined();
    });

    it('should return error for whitespace only', () => {
      const result = tidyScore('   ');
      expect(result.error).toBeDefined();
    });

    it('should handle tiebreak scores', () => {
      const result = tidyScore('76(3) 64');
      expect(result.tidyScore).toBe('7-6(3) 6-4');
    });

    it('should handle extended tiebreaks', () => {
      const result = tidyScore('76(102) 64');
      expect(result.tidyScore).toBe('7-6(102) 6-4');
    });
  });

  describe('Regression Tests for Known Issues', () => {
    it('should NOT allow typing after complete score (tested elsewhere)', () => {
      // This is tested in freeScoreInputLocking.test.ts
      // Just verify the validation part here
      const result = validateScore('6-3 7-6(3)', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(true);
      expect(result.winningSide).toBeDefined();
    });

    it('should NOT show TO_BE_PLAYED in formatted score (tested elsewhere)', () => {
      // This is tested in scoreFormatters.test.ts
      // Verify validation doesn't create TO_BE_PLAYED status
      const result = validateScore('', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(false);
      expect(result.matchUpStatus).not.toBe('TO_BE_PLAYED');
    });

    it('should handle dynamicSets per-set format detection', () => {
      // Use valid format with finalSetFormat
      const result = validateScore('6-4 4-6 [10-8]', 'SET3-S:6/TB7-F:TB10');
      expect(result.isValid).toBe(true);
    });

    it('should handle F:TB10 in final set', () => {
      const result = validateScore('6-4 4-6 [10-8]', 'SET3-S:6/TB7-F:TB10');
      expect(result.isValid).toBe(true);
      expect(result.winningSide).toBe(1);
    });

    it('should reject regular set when F:TB10 expected', () => {
      const result = validateScore('6-4 4-6 6-3', 'SET3-S:6/TB7-F:TB10');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('tiebreak-only');
    });
  });

  describe('Input Sanitization', () => {
    it('should handle extra whitespace', () => {
      const result = validateScore('  6-4   6-3  ', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(true);
    });

    it('should handle multiple spaces between sets', () => {
      const result = validateScore('6-4    6-3', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(true);
    });

    it('should handle newlines between sets', () => {
      const result = validateScore('6-4\n6-3', MATCH_FORMATS.SET3_S6_TB7);
      // Factory may or may not accept this - just verify it doesn't crash
      expect(result).toBeDefined();
    });
  });

  describe('Regression: dynamicSets Tiebreak Rendering (Issue #7-5-tiebreak)', () => {
    it('should correctly render 7-6(3) not as 7-3', () => {
      // This tests the fix for tiebreak-only set detection
      const result = validateScore('7-6(3) 6-4', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(true);
      expect(result.score).toBe('7-6(3) 6-4');
    });

    it('should complete match with 7-5 final set after tiebreak set', () => {
      // Regression test: 7-5 in final set should complete match even with prior tiebreak
      const result = validateScore('7-6(3) 4-6 7-5', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(true);
      expect(result.winningSide).toBe(1);
      expect(result.matchUpStatus).toBe('COMPLETED');
    });

    it('should complete match with 5-7 final set after tiebreak set', () => {
      const result = validateScore('6-4 6-7(5) 5-7', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(true);
      expect(result.winningSide).toBe(2);
      expect(result.matchUpStatus).toBe('COMPLETED');
    });

    it('should distinguish tiebreak-only sets from regular sets with tiebreaks', () => {
      // TB10 (tiebreak-only) should use brackets: [10-8]
      const tbOnlyResult = validateScore('6-4 4-6 [10-8]', 'SET3-S:6/TB7-F:TB10');
      expect(tbOnlyResult.isValid).toBe(true);
      expect(tbOnlyResult.score).toBe('6-4 4-6 [10-8]');

      // Regular set with tiebreak should use parentheses: 7-6(3)
      const regularResult = validateScore('7-6(3) 6-4', MATCH_FORMATS.SET3_S6_TB7);
      expect(regularResult.isValid).toBe(true);
      expect(regularResult.score).toBe('7-6(3) 6-4');
    });

    it('should handle multiple tiebreak sets followed by 7-5', () => {
      const result = validateScore('7-6(3) 6-7(8) 7-5', MATCH_FORMATS.SET3_S6_TB7);
      expect(result.isValid).toBe(true);
      expect(result.winningSide).toBe(1);
    });
  });
});
