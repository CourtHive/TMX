/**
 * Tests for aggregate scoring with conditional final tiebreak
 * Format: SET3X-S:T10A-F:TB1 and SET4X-S:T10A-F:TB1
 */

import { describe, it, expect } from 'vitest';
import { parseScore } from './freeScore';

describe('freeScore - Aggregate Scoring with Conditional TB', () => {
  describe('SET3X-S:T10A-F:TB1 (3 sets, aggregate, conditional TB1)', () => {
    const format = 'SET3X-S:T10A-F:TB1';

    it('should accept 2 sets when aggregate not tied (side 2 wins)', () => {
      const result = parseScore('30-25 20-30', format);
      
      // Aggregate: 50-55, side 2 wins, no TB needed
      expect(result.valid).toBe(true);
      expect(result.sets.length).toBe(2);
      expect(result.matchComplete).toBe(true);
      expect(result.formattedScore).toBe('30-25 20-30');
    });

    it('should accept 2 sets when aggregate not tied (side 1 wins)', () => {
      const result = parseScore('30-25 45-55', format);
      
      // Aggregate: 75-80, side 2 wins
      expect(result.valid).toBe(true);
      expect(result.sets.length).toBe(2);
      expect(result.matchComplete).toBe(true);
    });

    it('should accept 3 sets with TB when aggregate tied', () => {
      const result = parseScore('30-25 25-30 1-0', format);
      
      // Aggregate: 55-55, TB decides
      expect(result.valid).toBe(true);
      expect(result.sets.length).toBe(3);
      expect(result.matchComplete).toBe(true);
      expect(result.sets[2].side1TiebreakScore).toBe(1);
      expect(result.sets[2].side2TiebreakScore).toBe(0);
    });

    it('should accept 3 sets with TB score 0-1', () => {
      const result = parseScore('30-25 25-30 0-1', format);
      
      // Aggregate: 55-55, TB decides
      expect(result.valid).toBe(true);
      expect(result.sets.length).toBe(3);
      expect(result.sets[2].side1TiebreakScore).toBe(0);
      expect(result.sets[2].side2TiebreakScore).toBe(1);
    });

    it('should reject 2 sets when aggregate tied (missing TB)', () => {
      const result = parseScore('30-25 25-30', format);
      
      // Aggregate: 55-55, TB required
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Aggregate tied');
      expect(result.errors[0].message).toContain('TB required');
    });

    it('should reject 3 sets when aggregate not tied (TB not allowed)', () => {
      const result = parseScore('30-25 20-30 1-0', format);
      
      // Aggregate: 50-55, side 2 wins, TB not allowed
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('not tied');
      expect(result.errors[0].message).toContain('not allowed');
    });

    it('should reject invalid TB scores (2-0)', () => {
      const result = parseScore('30-25 25-30 2-0', format);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('TB1 only accepts "1-0" or "0-1"');
    });

    it('should reject invalid TB scores (7-5)', () => {
      const result = parseScore('30-25 25-30 7-5', format);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('TB1 only accepts');
    });

    it('should reject 4 sets (too many)', () => {
      const result = parseScore('30-25 20-30 25-25 1-0', format);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Too many sets');
    });

    it('should mark as incomplete with only 1 set', () => {
      const result = parseScore('30-25', format);
      
      expect(result.valid).toBe(false);
      expect(result.incomplete).toBe(true);
      expect(result.matchComplete).toBe(false);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('SET4X-S:T10A-F:TB1 (4 sets, aggregate, conditional TB1)', () => {
    const format = 'SET4X-S:T10A-F:TB1';

    it('should accept 3 sets when aggregate not tied', () => {
      const result = parseScore('30-25 20-30 45-50', format);
      
      // Aggregate: 95-105, side 2 wins
      expect(result.valid).toBe(true);
      expect(result.sets.length).toBe(3);
      expect(result.matchComplete).toBe(true);
    });

    it('should accept 4 sets with TB when aggregate tied', () => {
      const result = parseScore('30-25 20-30 25-25 1-0', format);
      
      // Aggregate: 75-75, TB decides
      expect(result.valid).toBe(true);
      expect(result.sets.length).toBe(4);
      expect(result.matchComplete).toBe(true);
      expect(result.sets[3].side1TiebreakScore).toBe(1);
    });

    it('should reject 3 sets when aggregate tied (missing TB)', () => {
      const result = parseScore('30-25 20-30 25-25', format);
      
      // Aggregate: 75-75, TB required
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Aggregate tied');
    });

    it('should reject 4 sets when aggregate not tied (TB not allowed)', () => {
      const result = parseScore('30-25 20-30 30-20 1-0', format);
      
      // Aggregate: 80-75, TB not allowed
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('not tied');
    });

    it('should mark as incomplete with only 2 sets', () => {
      const result = parseScore('30-25 20-30', format);
      
      expect(result.valid).toBe(false);
      expect(result.incomplete).toBe(true);
      expect(result.matchComplete).toBe(false);
    });
  });

  describe('SET3X-S:T10A-F:TB1NOAD (NoAD final TB)', () => {
    const format = 'SET3X-S:T10A-F:TB1NOAD';

    it('should accept TB with NoAD format (same validation as TB1)', () => {
      const result = parseScore('30-25 25-30 1-0', format);
      
      expect(result.valid).toBe(true);
      expect(result.sets[2].side1TiebreakScore).toBe(1);
    });

    it('should reject invalid TB scores for NoAD', () => {
      const result = parseScore('30-25 25-30 2-1', format);
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('TB1 only accepts');
    });
  });

  describe('Edge Cases', () => {
    const format = 'SET3X-S:T10A-F:TB1';

    it('should handle aggregate tied at 0-0', () => {
      const result = parseScore('0-0 0-1', format);
      
      // Aggregate: 0-1, side 2 wins
      expect(result.valid).toBe(true);
      expect(result.sets.length).toBe(2);
    });

    it('should handle high aggregate scores', () => {
      const result = parseScore('100-50 50-100 1-0', format);
      
      // Aggregate: 150-150, TB decides
      expect(result.valid).toBe(true);
      expect(result.sets.length).toBe(3);
    });

    it('should handle one-sided match (50-0 0-40)', () => {
      const result = parseScore('50-0 0-40', format);
      
      // Aggregate: 50-40, side 1 wins
      expect(result.valid).toBe(true);
      expect(result.sets.length).toBe(2);
      expect(result.matchComplete).toBe(true);
    });
  });

  describe('Regular timed sets (no aggregate)', () => {
    it('should still work for SET3X-S:T10 (no aggregate)', () => {
      const format = 'SET3X-S:T10';
      const result = parseScore('30-25 20-30 35-30', format);
      
      // Regular timed, all 3 sets required
      expect(result.valid).toBe(true);
      expect(result.sets.length).toBe(3);
    });

    it('should reject 2 sets for SET3X-S:T10 (no conditional logic)', () => {
      const format = 'SET3X-S:T10';
      const result = parseScore('30-25 20-30', format);
      
      // Not aggregate, so all 3 sets required
      expect(result.valid).toBe(false);
      expect(result.incomplete).toBe(true);
    });
  });
});
