/**
 * Tests for validateScore with incomplete aggregate scores
 * Verifies that partial sets don't show as complete matches for aggregate scoring
 */
import { describe, it, expect } from 'vitest';
import { validateScore } from '../scoreValidator';

describe('validateScore - Aggregate incomplete handling', () => {
  const format = 'SET3X-S:T10A';

  it('should NOT treat incomplete third set as complete match', () => {
    // 2 complete sets + 1 incomplete (only side1)
    const scoreString = '10-1 0-1 1';
    const result = validateScore(scoreString, format);

    // Should NOT be valid for submission
    expect(result.isValid).toBe(false);
    expect(result.winningSide).toBeUndefined();
    expect(result.error).toContain('Incomplete match');
  });

  it('should accept 3 complete sets as valid', () => {
    // All 3 sets complete
    const scoreString = '10-1 0-1 1-0';
    const result = validateScore(scoreString, format);

    expect(result.isValid).toBe(true);
    expect(result.winningSide).toBeDefined();
    expect(result.matchUpStatus).toBe('COMPLETED');
  });

  it('should NOT accept 2 complete sets as valid for SET3X', () => {
    // Only 2 complete sets
    const scoreString = '10-1 0-1';
    const result = validateScore(scoreString, format);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Incomplete match');
  });

  it('should handle incomplete second set', () => {
    const scoreString = '10-1 5';
    const result = validateScore(scoreString, format);

    expect(result.isValid).toBe(false);
    expect(result.winningSide).toBeUndefined();
  });

  it('should handle incomplete first set', () => {
    const scoreString = '10';
    const result = validateScore(scoreString, format);

    expect(result.isValid).toBe(false);
    expect(result.winningSide).toBeUndefined();
  });

  it('should require all 3 sets for SET3X even if aggregate winner is clear', () => {
    // Side 1 is winning aggregate (30-1=+29, 0-1=-1), total +28
    // But only 2 complete sets, need 3 for SET3X
    const scoreString = '30-1 0-1';
    const result = validateScore(scoreString, format);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Incomplete match');
  });

  it('should work with SET4X format', () => {
    const format = 'SET4X-S:T10A';
    
    // 3 complete sets + 1 incomplete
    const scoreString = '10-1 0-1 5-3 2';
    const result = validateScore(scoreString, format);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Incomplete match');
  });

  it('should validate 4 complete sets for SET4X', () => {
    const format = 'SET4X-S:T10A';
    
    const scoreString = '10-1 0-1 5-3 2-8';
    const result = validateScore(scoreString, format);

    expect(result.isValid).toBe(true);
    expect(result.winningSide).toBeDefined();
  });
});

describe('validateScore - Aggregate with TB1 final', () => {
  const format = 'SET3X-S:T10A-F:TB1';

  it('should handle incomplete sets before TB', () => {
    const scoreString = '10-1 5';
    const result = validateScore(scoreString, format);

    expect(result.isValid).toBe(false);
    expect(result.winningSide).toBeUndefined();
  });

  it('should handle complete aggregate tie with TB', () => {
    // Aggregate: 30-25 + 25-30 = 55-55 (tied)
    // TB: 1-0 (side 1 wins)
    const scoreString = '30-25 25-30 [1-0]';
    const result = validateScore(scoreString, format);

    expect(result.isValid).toBe(true);
    expect(result.winningSide).toBe(1);
  });

  it('should NOT accept incomplete third set even if aggregate is tied', () => {
    // Aggregate so far: 30-25 + 25-30 = 55-55 (tied)
    // But third set is incomplete (only "1")
    const scoreString = '30-25 25-30 1';
    const result = validateScore(scoreString, format);

    expect(result.isValid).toBe(false);
    expect(result.winningSide).toBeUndefined();
  });
});
