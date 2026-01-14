/**
 * Tests for aggregate scoring winner calculation in scoreValidator
 * Tests the score validation logic for aggregate scoring formats
 */

import { describe, it, expect } from 'vitest';
import { validateScore } from '../scoreValidator';

describe('scoreValidator - Aggregate Scoring', () => {
  describe('SET3X-S:T10A (exactly 3 sets, aggregate scoring)', () => {
    const format = 'SET3X-S:T10A';

    it('should calculate winningSide based on aggregate totals, not sets won (30-0, 0-1, 0-1)', () => {
      const scoreString = '30-0 0-1 0-1';
      const result = validateScore(scoreString, format);

      // Aggregate: side1=30, side2=2
      // Sets won: side1=1, side2=2
      // Winner should be side 1 (aggregate 30 > 2), NOT side 2 (sets won)
      expect(result.isValid).toBe(true);
      expect(result.winningSide).toBe(1);
      expect(result.sets?.length).toBe(3);
    });

    it('should calculate winningSide correctly when aggregate is close (10-11, 11-10, 5-4)', () => {
      const scoreString = '10-11 11-10 5-4';
      const result = validateScore(scoreString, format);

      // Aggregate: side1=26, side2=25
      // Sets won: side1=2, side2=1
      // Winner: side 1 by both measures (but aggregate is authoritative)
      expect(result.isValid).toBe(true);
      expect(result.winningSide).toBe(1);
    });

    it('should calculate winningSide correctly when aggregate winner differs from sets winner', () => {
      const scoreString = '100-0 0-1 0-1';
      const result = validateScore(scoreString, format);

      // Aggregate: side1=100, side2=2
      // Sets won: side1=1, side2=2
      // Winner should be side 1 (aggregate dominates)
      expect(result.isValid).toBe(true);
      expect(result.winningSide).toBe(1);
    });

    it('should handle edge case where one set has no clear winner', () => {
      const scoreString = '10-11 11-10 6-5';
      const result = validateScore(scoreString, format);

      // Aggregate: side1=27, side2=26 (side 1 wins)
      // Sets won: side1=2, side2=1
      // Winner: side 1 (by aggregate)
      expect(result.isValid).toBe(true);
      expect(result.winningSide).toBe(1);
    });

    it('should require all 3 sets for exactly format', () => {
      const scoreString = '30-0 0-1';
      const result = validateScore(scoreString, format);

      // Only 2 sets when 3 expected
      expect(result.isValid).toBe(false);
    });
  });

  describe('SET3X-S:T10 (exactly 3 sets, standard scoring - not aggregate)', () => {
    const format = 'SET3X-S:T10';

    it('should calculate winningSide based on sets won, not aggregate', () => {
      const scoreString = '10-11 11-10 1-0';
      const result = validateScore(scoreString, format);

      // Aggregate: side1=22, side2=21 (side 1 ahead)
      // Sets won: side1=2, side2=1 (side 1 wins)
      // Winner: side 1 (by sets won)
      expect(result.isValid).toBe(true);
      expect(result.winningSide).toBe(1);
    });

    it('should not use aggregate totals for non-aggregate format', () => {
      const scoreString = '100-0 0-1 0-1';
      const result = validateScore(scoreString, format);

      // Aggregate: side1=100, side2=2 (side 1 dominates)
      // Sets won: side1=1, side2=2 (side 2 wins)
      // Winner: side 2 (by sets won - aggregate is ignored)
      expect(result.isValid).toBe(true);
      expect(result.winningSide).toBe(2);
    });
  });

  describe('SET3X-S:T10A-F:TB1 (aggregate with conditional final tiebreak)', () => {
    const format = 'SET3X-S:T10A-F:TB1';

    it('should handle aggregate tie resolved by final tiebreak', () => {
      // Use bracket notation for tiebreak-only final set
      const scoreString = '30-25 25-30 [1-0]';
      const result = validateScore(scoreString, format);

      // Aggregate: side1=55, side2=55 (tied)
      // Final TB: 1-0 for side 1
      // Winner: side 1 (by tiebreak)
      expect(result.isValid).toBe(true);
      expect(result.winningSide).toBe(1);
    });

    it('should require all 3 sets for exactly format even with conditional TB', () => {
      const scoreString = '30-25 20-30';
      const result = validateScore(scoreString, format);

      // Only 2 sets provided for SET3X format
      // Even with conditional TB, validateScore requires proper parsing from freeScore
      // which handles the conditional TB logic
      expect(result.isValid).toBe(false);
    });
  });
});
