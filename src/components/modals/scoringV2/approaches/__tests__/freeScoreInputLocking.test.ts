/**
 * Test suite for freeScore input locking behavior
 * 
 * Tests the logic that prevents additional input after a complete score + separator.
 * This ensures users cannot enter garbage after match completion.
 * 
 * Key behaviors tested:
 * 1. Match locks when complete score + separator typed
 * 2. Match unlocks when separator removed via backspace
 * 3. Match unlocks when input cleared completely
 * 4. Incomplete scores don't lock (even with separator)
 * 5. Extended tiebreaks allowed before separator
 */

import { describe, it, expect } from 'vitest';
import { parseScore } from '../../../../../tools/freeScore/freeScore';
import { validateScore } from '../../utils/scoreValidator';
import { MATCH_FORMATS } from '../../../../../constants/matchUpFormats';

/**
 * Simulates the input locking logic from freeScoreApproach.ts
 * Returns whether input should be locked based on current value
 */
function shouldLockInput(
  currentValue: string,
  previouslyLocked: boolean,
  matchUpFormat: any
): boolean {
  const rawValue = currentValue;
  const scoreString = rawValue.trim();

  if (!previouslyLocked && scoreString) {
    // Not yet locked - check if we should lock it
    const parseResult = parseScore(scoreString, matchUpFormat);
    const validation = parseResult.formattedScore
      ? validateScore(parseResult.formattedScore, matchUpFormat, parseResult.matchUpStatus)
      : { isValid: false, winningSide: undefined };

    const hasWinner = validation.isValid && validation.winningSide !== undefined;
    const endsWithSeparator = rawValue.length > 0 && /[\s\-]$/.test(rawValue);

    // Lock if it has a winner AND ends with a separator
    if (hasWinner && endsWithSeparator) {
      return true;
    }
  } else if (previouslyLocked) {
    // Already locked - check if we should unlock it
    const endsWithSeparator = rawValue.length > 0 && /[\s\-]$/.test(rawValue);
    if (scoreString.length === 0 || !endsWithSeparator) {
      return false; // Unlock
    }
    return true; // Stay locked
  }

  return false;
}

/**
 * Simulates a sequence of input changes and returns lock states
 */
function simulateInputSequence(
  inputs: string[],
  matchUpFormat: any
): boolean[] {
  let locked = false;
  const lockStates: boolean[] = [];

  for (const input of inputs) {
    locked = shouldLockInput(input, locked, matchUpFormat);
    lockStates.push(locked);
  }

  return lockStates;
}

describe('freeScore Input Locking Logic', () => {
  const SET3_FORMAT = MATCH_FORMATS.SET3_S6_TB7;
  const SET5_FORMAT = MATCH_FORMATS.SET5_S6_TB7;

  describe('Basic Locking on Complete Score + Separator', () => {
    it('should lock after complete 2-set match with trailing space', () => {
      const inputs = ['6', '63', '63 ', '63 7', '63 76', '63 763', '63 7633', '63 7633 '];
      const lockStates = simulateInputSequence(inputs, SET3_FORMAT);

      expect(lockStates).toEqual([
        false, // "6" - incomplete
        false, // "63" - incomplete (6-3, need 2nd set)
        false, // "63 " - incomplete (6-3, need 2nd set)
        false, // "63 7" - incomplete (6-3 vs 7, invalid)
        false, // "63 76" - incomplete (6-3 6-7, needs tiebreak)
        false, // "63 763" - incomplete (6-3 6-7(3), needs separator to lock)
        false, // "63 7633" - incomplete (can still extend tiebreak)
        true,  // "63 7633 " - LOCKED (complete + separator)
      ]);
    });

    it('should lock after complete 3-set match with trailing space', () => {
      const inputs = ['64', '64 ', '64 46', '64 46 ', '64 46 63', '64 46 63 '];
      const lockStates = simulateInputSequence(inputs, SET3_FORMAT);

      expect(lockStates).toEqual([
        false, // "64" - incomplete
        false, // "64 " - incomplete
        false, // "64 46" - incomplete (1-1)
        false, // "64 46 " - incomplete (1-1)
        false, // "64 46 63" - complete but no separator
        true,  // "64 46 63 " - LOCKED
      ]);
    });

    it('should lock with dash separator', () => {
      const inputs = ['63', '63-', '63-76', '63-763', '63-7633', '63-7633-'];
      const lockStates = simulateInputSequence(inputs, SET3_FORMAT);

      expect(lockStates).toEqual([
        false, // "63" - incomplete
        false, // "63-" - incomplete (separator but not between sets)
        false, // "63-76" - incomplete
        false, // "63-763" - incomplete
        false, // "63-7633" - complete but no trailing separator
        true,  // "63-7633-" - LOCKED (dash is separator)
      ]);
    });
  });

  describe('Extended Tiebreak Handling', () => {
    it('should allow extending tiebreak before separator', () => {
      const inputs = [
        '36',
        '36 ',
        '36 67',
        '36 673',   // Could be 6-7(3) complete
        '36 6733',  // Extended to 6-7(33)
        '36 67102', // Extended to 6-7(102)
        '36 67102 ', // NOW locked
      ];
      const lockStates = simulateInputSequence(inputs, SET3_FORMAT);

      expect(lockStates).toEqual([
        false, // "36" - incomplete
        false, // "36 " - incomplete
        false, // "36 67" - incomplete (needs tiebreak)
        false, // "36 673" - can still extend
        false, // "36 6733" - can still extend
        false, // "36 67102" - can still extend
        true,  // "36 67102 " - LOCKED
      ]);
    });

    it('should allow extending first set tiebreak', () => {
      const inputs = ['76', '763', '7633', '76102', '76102 ', '76102 64', '76102 64 '];
      const lockStates = simulateInputSequence(inputs, SET3_FORMAT);

      expect(lockStates).toEqual([
        false, // "76" - incomplete
        false, // "763" - incomplete (7-6(3), need 2nd set)
        false, // "7633" - incomplete (7-6(33), need 2nd set)
        false, // "76102" - incomplete (7-6(102), need 2nd set)
        false, // "76102 " - incomplete (need 2nd set)
        false, // "76102 64" - complete but no separator
        true,  // "76102 64 " - LOCKED
      ]);
    });
  });

  describe('Unlocking via Backspace', () => {
    it('should unlock when separator removed', () => {
      // Simulate: type "63 7633 " → locked → backspace → unlocked
      let locked = false;
      
      // Build up to complete score with separator
      locked = shouldLockInput('63 7633 ', locked, SET3_FORMAT);
      expect(locked).toBe(true);

      // Backspace removes space
      locked = shouldLockInput('63 7633', locked, SET3_FORMAT);
      expect(locked).toBe(false);
    });

    it('should allow re-typing after unlocking', () => {
      const inputs = [
        '63 7633 ',  // Locked
        '63 7633',   // Unlocked (backspace)
        '63 76333',  // Still unlocked (extended tiebreak)
        '63 76333 ', // Locked again
      ];
      const lockStates = simulateInputSequence(inputs, SET3_FORMAT);

      expect(lockStates).toEqual([
        true,  // Locked with separator
        false, // Unlocked when separator removed
        false, // Can continue typing
        true,  // Locked again with new separator
      ]);
    });

    it('should unlock when backspacing through multiple spaces', () => {
      let locked = false;

      // Multiple spaces
      locked = shouldLockInput('63 7633  ', locked, SET3_FORMAT);
      expect(locked).toBe(true);

      // Remove one space (still has trailing space)
      locked = shouldLockInput('63 7633 ', locked, SET3_FORMAT);
      expect(locked).toBe(true);

      // Remove last space
      locked = shouldLockInput('63 7633', locked, SET3_FORMAT);
      expect(locked).toBe(false);
    });
  });

  describe('Clear All Unlocking', () => {
    it('should unlock when input completely cleared', () => {
      let locked = false;

      // Lock it
      locked = shouldLockInput('64 63 ', locked, SET3_FORMAT);
      expect(locked).toBe(true);

      // Clear all (Ctrl+A, Delete)
      locked = shouldLockInput('', locked, SET3_FORMAT);
      expect(locked).toBe(false);
    });

    it('should stay locked while backspacing through score', () => {
      let locked = false;

      // Lock it
      locked = shouldLockInput('64 63 ', locked, SET3_FORMAT);
      expect(locked).toBe(true);

      // Backspace removes space → should unlock
      locked = shouldLockInput('64 63', locked, SET3_FORMAT);
      expect(locked).toBe(false);
    });
  });

  describe('Incomplete Scores Should Not Lock', () => {
    it('should not lock incomplete score with separator', () => {
      const inputs = ['6', '63', '63 ']; // Only one set, need 2 to win
      const lockStates = simulateInputSequence(inputs, SET3_FORMAT);

      expect(lockStates).toEqual([
        false, // "6" - incomplete
        false, // "63" - incomplete
        false, // "63 " - incomplete (separator but only 1 set)
      ]);
    });

    it('should not lock tied score with separator', () => {
      const inputs = ['64', '64 ', '64 46', '64 46 ']; // 1-1 tied
      const lockStates = simulateInputSequence(inputs, SET3_FORMAT);

      expect(lockStates).toEqual([
        false, // "64" - incomplete
        false, // "64 " - incomplete
        false, // "64 46" - incomplete (tied 1-1)
        false, // "64 46 " - incomplete (tied, need 3rd set)
      ]);
    });

    it('should not lock invalid score with separator', () => {
      const inputs = ['66', '66 ']; // Invalid (tied at 6-6, needs tiebreak)
      const lockStates = simulateInputSequence(inputs, SET3_FORMAT);

      expect(lockStates).toEqual([
        false, // "66" - invalid
        false, // "66 " - invalid (can't have 6-6)
      ]);
    });

    it('should not lock set needing tiebreak with separator', () => {
      const inputs = ['67', '67 ']; // 6-7 needs tiebreak score
      const lockStates = simulateInputSequence(inputs, SET3_FORMAT);

      expect(lockStates).toEqual([
        false, // "67" - incomplete (needs tiebreak)
        false, // "67 " - incomplete (needs tiebreak)
      ]);
    });
  });

  describe('Best-of-5 Matches', () => {
    it('should lock after 3-0 best-of-5 match', () => {
      const inputs = ['64', '64 63', '64 63 62', '64 63 62 '];
      const lockStates = simulateInputSequence(inputs, SET5_FORMAT);

      expect(lockStates).toEqual([
        false, // "64" - incomplete
        false, // "64 63" - incomplete (2-0, need 3 to win)
        false, // "64 63 62" - complete (3-0) but no separator
        true,  // "64 63 62 " - LOCKED
      ]);
    });

    it('should lock after 3-2 best-of-5 match', () => {
      const inputs = [
        '64',
        '64 46',
        '64 46 63',
        '64 46 63 36',
        '64 46 63 36 75',
        '64 46 63 36 75 ',
      ];
      const lockStates = simulateInputSequence(inputs, SET5_FORMAT);

      expect(lockStates).toEqual([
        false, // "64" - incomplete
        false, // "64 46" - incomplete (1-1)
        false, // "64 46 63" - incomplete (2-1)
        false, // "64 46 63 36" - incomplete (2-2)
        false, // "64 46 63 36 75" - complete but no separator
        true,  // "64 46 63 36 75 " - LOCKED
      ]);
    });

    it('should not lock 2-2 tied best-of-5 with separator', () => {
      const inputs = ['64', '64 46', '64 46 63', '64 46 63 36', '64 46 63 36 '];
      const lockStates = simulateInputSequence(inputs, SET5_FORMAT);

      expect(lockStates).toEqual([
        false, // "64" - incomplete
        false, // "64 46" - incomplete
        false, // "64 46 63" - incomplete
        false, // "64 46 63 36" - incomplete (2-2)
        false, // "64 46 63 36 " - incomplete (need 5th set)
      ]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string', () => {
      const locked = shouldLockInput('', false, SET3_FORMAT);
      expect(locked).toBe(false);
    });

    it('should handle whitespace only', () => {
      const locked = shouldLockInput('   ', false, SET3_FORMAT);
      expect(locked).toBe(false);
    });

    it('should handle single digit', () => {
      const locked = shouldLockInput('6', false, SET3_FORMAT);
      expect(locked).toBe(false);
    });

    it('should handle tab as separator', () => {
      let locked = false;
      locked = shouldLockInput('63 7633\t', locked, SET3_FORMAT);
      expect(locked).toBe(true); // \t matches \s in regex
    });

    it('should maintain lock state with multiple trailing spaces', () => {
      let locked = false;

      locked = shouldLockInput('64 63 ', locked, SET3_FORMAT);
      expect(locked).toBe(true);

      locked = shouldLockInput('64 63  ', locked, SET3_FORMAT);
      expect(locked).toBe(true);

      locked = shouldLockInput('64 63   ', locked, SET3_FORMAT);
      expect(locked).toBe(true);
    });
  });

  describe('Integration: Complete Input Flows', () => {
    it('should handle typical match entry flow', () => {
      const typingSequence = [
        '6',        // Start first set
        '63',       // First set complete
        '63 ',      // Separator
        '63 7',     // Start second set
        '63 76',    // Second set score
        '63 763',   // Tiebreak score
        '63 7633',  // Extended tiebreak
        '63 7633 ', // Complete! SHOULD LOCK (side 2 wins 2-0)
      ];

      const lockStates = simulateInputSequence(typingSequence, SET3_FORMAT);

      expect(lockStates[lockStates.length - 1]).toBe(true);
      expect(lockStates.slice(0, -1).every(state => state === false)).toBe(true);
    });

    it('should handle mistake correction flow', () => {
      const sequence = [
        '63 7633 ', // Complete and locked (side 2 wins)
        '63 7633',  // Backspace → unlocked
        '63 763',   // Continue backspacing
        '63 7636',  // Correct tiebreak score
        '63 7636 ', // Lock again
      ];

      const lockStates = simulateInputSequence(sequence, SET3_FORMAT);

      expect(lockStates).toEqual([
        true,  // Locked
        false, // Unlocked
        false, // Still unlocked
        false, // Still unlocked
        true,  // Locked again
      ]);
    });

    it('should handle extended tiebreak then lock', () => {
      const sequence = [
        '76',
        '763',
        '7633',     // Extended
        '76102',    // Extended more
        '76102 ',   // Separator but incomplete (need 2nd set)
        '76102 64', // Complete (side 1 wins 2-0)
        '76102 64 ', // LOCK
      ];

      const lockStates = simulateInputSequence(sequence, SET3_FORMAT);

      expect(lockStates).toEqual([
        false, // Incomplete
        false, // Incomplete
        false, // Incomplete
        false, // Incomplete
        false, // Incomplete (only 1 set)
        false, // Complete but no trailing separator
        true,  // LOCKED
      ]);
    });
  });
});
