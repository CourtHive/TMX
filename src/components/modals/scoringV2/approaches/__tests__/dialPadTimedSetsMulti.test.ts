/**
 * Tests for dialPad timed sets with multiple sets
 * Specifically tests the issue where entering "10-1-" should start second set
 */
import { describe, it, expect } from 'vitest';
import { formatScoreString } from '../dialPadLogic';

describe('dialPadLogic - Timed sets multi-set entry', () => {
  const format = 'SET3X-S:T10';

  it('should recognize minus after complete set as set separator', () => {
    // User enters: 1, 0, -, 1, -
    // This should parse as: Set 1: "10-1", Set 2: (starting)
    const digits = '10-1-';
    const result = formatScoreString(digits, { matchUpFormat: format });
    
    // Should show first set complete, ready for second set
    expect(result).toBe('10-1');
  });

  it('should parse two complete sets with single minus separator', () => {
    // User enters: 1, 0, -, 1, -, 0, -, 1
    const digits = '10-1-0-1';
    const result = formatScoreString(digits, { matchUpFormat: format });
    
    // Should parse as: Set 1: "10-1", Set 2: "0-1"
    expect(result).toBe('10-1 0-1');
  });

  it('should parse three complete sets', () => {
    const digits = '10-1-0-1-5-3';
    const result = formatScoreString(digits, { matchUpFormat: format });
    expect(result).toBe('10-1 0-1 5-3');
  });

  it('should handle partial third set', () => {
    const digits = '10-1-0-1-5';
    const result = formatScoreString(digits, { matchUpFormat: format });
    // Third set incomplete (only side1) - show partial progress
    expect(result).toBe('10-1 0-1 5');
  });

  it('should handle high scores across multiple sets', () => {
    const digits = '30-25-25-30-35-20';
    const result = formatScoreString(digits, { matchUpFormat: format });
    expect(result).toBe('30-25 25-30 35-20');
  });

  it('should stop at bestOf limit (3 sets)', () => {
    const digits = '10-1-0-1-5-3-7-2';
    const result = formatScoreString(digits, { matchUpFormat: format });
    // Should only take first 3 sets
    expect(result).toBe('10-1 0-1 5-3');
  });

  it('should handle SET3X-S:T10A aggregate format', () => {
    const format = 'SET3X-S:T10A';
    const digits = '30-1-0-1-0-1';
    const result = formatScoreString(digits, { matchUpFormat: format });
    expect(result).toBe('30-1 0-1 0-1');
  });

  it('should handle mixed single and double digit scores', () => {
    const digits = '9-10-10-9-11-8';
    const result = formatScoreString(digits, { matchUpFormat: format });
    expect(result).toBe('9-10 10-9 11-8');
  });
});

describe('dialPadLogic - Timed sets with trailing minus', () => {
  const format = 'SET3X-S:T10';

  it('should handle trailing minus after incomplete set', () => {
    // User enters: 1, 0, -
    // This is incomplete (only side1), but show partial progress
    const digits = '10-';
    const result = formatScoreString(digits, { matchUpFormat: format });
    expect(result).toBe('10');
  });

  it('should handle trailing minus after complete set', () => {
    // User enters: 1, 0, -, 1, -
    // First set complete, second set starting
    const digits = '10-1-';
    const result = formatScoreString(digits, { matchUpFormat: format });
    expect(result).toBe('10-1');
  });

  it('should handle multiple trailing minuses', () => {
    // User enters: 1, 0, -, 1, -, -
    // First set complete, double minus should be treated as set separator
    const digits = '10-1--';
    const result = formatScoreString(digits, { matchUpFormat: format });
    expect(result).toBe('10-1');
  });
});
