/**
 * Tests for freeText score validation
 * Focus: Ensure submitted set types match format expectations
 */
import { describe, it, expect } from 'vitest';
import { validateScore } from '../scoreValidator';

describe('FreeText Validation - Set Type Matching', () => {
  describe('Regular format (no F:TB) should reject tiebreak-only sets', () => {
    it('should reject tiebreak-only set in third position when format has no F:TB', () => {
      const scoreString = '6-7(3) 7-6(3) [1-10]';
      const matchUpFormat = 'SET3-S:6/TB7'; // No F:TB10
      
      const result = validateScore(scoreString, matchUpFormat);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Format expects regular set');
    });

    it('should reject tiebreak-only set in any position for standard format', () => {
      const scoreString = '[10-8] 6-4';
      const matchUpFormat = 'SET3-S:6/TB7';
      
      const result = validateScore(scoreString, matchUpFormat);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Format expects regular set');
    });

    it('should accept regular sets when format expects regular sets', () => {
      const scoreString = '6-4 4-6 6-3';
      const matchUpFormat = 'SET3-S:6/TB7';
      
      const result = validateScore(scoreString, matchUpFormat);
      
      expect(result.isValid).toBe(true);
    });

    it('should accept set tiebreaks in regular format', () => {
      const scoreString = '6-7(3) 7-6(5) 6-4';
      const matchUpFormat = 'SET3-S:6/TB7';
      
      const result = validateScore(scoreString, matchUpFormat);
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('F:TB format should require tiebreak-only set in final position', () => {
    it('should accept tiebreak-only set in third position when format has F:TB10', () => {
      const scoreString = '6-4 4-6 [10-8]';
      const matchUpFormat = 'SET3-S:6/TB7-F:TB10';
      
      const result = validateScore(scoreString, matchUpFormat);
      
      expect(result.isValid).toBe(true);
    });

    it('should reject regular set in third position when format expects F:TB10', () => {
      const scoreString = '6-4 4-6 6-3';
      const matchUpFormat = 'SET3-S:6/TB7-F:TB10';
      
      const result = validateScore(scoreString, matchUpFormat);
      
      // The third set should be invalid because format expects tiebreak-only
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('tiebreak-only');
    });

    it('should accept regular sets in non-final positions with F:TB format', () => {
      const scoreString = '6-7(3) 7-6(5) [11-9]';
      const matchUpFormat = 'SET3-S:6/TB7-F:TB10';
      
      const result = validateScore(scoreString, matchUpFormat);
      
      expect(result.isValid).toBe(true);
    });

    it('should work for SET5 F:TB10 format', () => {
      const scoreString = '6-4 3-6 6-3 4-6 [10-8]';
      const matchUpFormat = 'SET5-S:6/TB7-F:TB10';
      
      const result = validateScore(scoreString, matchUpFormat);
      
      expect(result.isValid).toBe(true);
    });

    it('should reject tiebreak-only set in non-final position even with F:TB', () => {
      const scoreString = '[10-8] 6-4 [11-9]';
      const matchUpFormat = 'SET3-S:6/TB7-F:TB10';
      
      const result = validateScore(scoreString, matchUpFormat);
      
      // First set should be invalid
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Format expects regular set');
    });
  });

  describe('Full tiebreak-only format (SET1-S:TB10)', () => {
    it('should accept tiebreak-only set when format is SET1-S:TB10', () => {
      const scoreString = '[10-8]';
      const matchUpFormat = 'SET1-S:TB10';
      
      const result = validateScore(scoreString, matchUpFormat);
      
      expect(result.isValid).toBe(true);
    });

    it('should reject regular set when format expects tiebreak-only', () => {
      const scoreString = '6-4';
      const matchUpFormat = 'SET1-S:TB10';
      
      const result = validateScore(scoreString, matchUpFormat);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Format expects tiebreak-only set');
    });
  });
});
