/**
 * Tests for dialPad incomplete set handling with timed formats
 * Verifies that partial sets don't show as complete matches
 */
import { describe, it, expect } from 'vitest';
import { formatScoreString } from '../dialPadLogic';

describe('dialPadLogic - Timed sets incomplete handling', () => {
  const format = 'SET3X-S:T10';

  it('should show incomplete third set without treating match as complete', () => {
    // User has entered: "10-1 1-0 1"
    // This is 2 complete sets + partial third set (only side1 = 1)
    const digits = '10-1 1-0 1';
    const result = formatScoreString(digits, { matchUpFormat: format });
    
    // Should show all 3 "sets" but third is incomplete
    expect(result).toBe('10-1 1-0 1');
  });

  it('should allow continuation after incomplete third set', () => {
    // User enters: "10-1 1-0 1" then "-0"
    const digits = '10-1 1-0 1-0';
    const result = formatScoreString(digits, { matchUpFormat: format });
    
    // Should now show 3 complete sets
    expect(result).toBe('10-1 1-0 1-0');
  });

  it('should handle incomplete second set', () => {
    const digits = '10-1 5';
    const result = formatScoreString(digits, { matchUpFormat: format });
    
    // First set complete, second set incomplete
    expect(result).toBe('10-1 5');
  });

  it('should handle incomplete first set', () => {
    const digits = '10';
    const result = formatScoreString(digits, { matchUpFormat: format });
    
    // Only side1 of first set
    expect(result).toBe('10');
  });

  it('should handle first set complete, second incomplete', () => {
    const digits = '10-1-0';
    const result = formatScoreString(digits, { matchUpFormat: format });
    
    // First set complete (10-1), second set incomplete (only side1 = 0)
    expect(result).toBe('10-1 0');
  });

  it('should handle aggregate format with incomplete sets', () => {
    const format = 'SET3X-S:T10A';
    const digits = '30-25 25';
    const result = formatScoreString(digits, { matchUpFormat: format });
    
    // First set complete, second incomplete
    expect(result).toBe('30-25 25');
  });

  it('should allow entering very low scores without completing', () => {
    // Edge case: scores like "1" shouldn't auto-complete
    const digits = '1';
    const result = formatScoreString(digits, { matchUpFormat: format });
    
    expect(result).toBe('1');
  });

  it('should handle all incomplete sets', () => {
    const digits = '1 2 3';
    const result = formatScoreString(digits, { matchUpFormat: format });
    
    // Three incomplete sets (each missing side2)
    expect(result).toBe('1 2 3');
  });
});

describe('dialPadLogic - Timed sets completion detection', () => {
  const format = 'SET3X-S:T10';

  it('should recognize truly complete match (3 sets, both scores each)', () => {
    const digits = '10-1 1-0 1-0';
    const result = formatScoreString(digits, { matchUpFormat: format });
    
    expect(result).toBe('10-1 1-0 1-0');
    // This should be treated as complete (3 sets with both scores)
  });

  it('should NOT treat partial third set as complete', () => {
    const digits = '10-1 1-0 5';
    const result = formatScoreString(digits, { matchUpFormat: format });
    
    // Only 2 complete sets + 1 incomplete
    expect(result).toBe('10-1 1-0 5');
    // This should NOT be treated as complete
  });

  it('should recognize 2 complete sets as incomplete match', () => {
    const digits = '10-1 1-0';
    const result = formatScoreString(digits, { matchUpFormat: format });
    
    expect(result).toBe('10-1 1-0');
    // Only 2 sets, need 3 for SET3X
  });
});
