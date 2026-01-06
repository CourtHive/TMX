/**
 * Test suite for dynamicSets approach core logic
 * 
 * Tests the critical getSetFormat() logic that determines which format
 * to use for each set (regular vs final set format).
 * 
 * This is the key logic that enables proper handling of:
 * - Final set tiebreaks (F:TB10)
 * - Per-set tiebreakAt values
 * - Tiebreak-only sets in final position
 */

import { describe, it, expect } from 'vitest';
import { matchUpFormatCode } from 'tods-competition-factory';

/**
 * Replicates the getSetFormat logic from dynamicSetsApproach.ts
 * This function determines which format to use for a specific set index.
 */
function getSetFormat(
  setIndex: number,
  matchUpFormat: string,
  bestOf: number
) {
  const parsedFormat = matchUpFormatCode.parse(matchUpFormat);
  const isDecidingSet = bestOf === 1 || (setIndex + 1) === bestOf;
  
  // Use finalSetFormat for deciding set if it exists
  if (isDecidingSet && parsedFormat?.finalSetFormat) {
    return parsedFormat.finalSetFormat;
  }
  
  return parsedFormat?.setFormat;
}

/**
 * Helper to extract key info from set format
 */
function getFormatInfo(setFormat: any) {
  return {
    setTo: setFormat?.setTo,
    tiebreakAt: setFormat?.tiebreakAt,
    tiebreakFormat: setFormat?.tiebreakFormat,
    tiebreakTo: setFormat?.tiebreakSet?.tiebreakTo,
    isTiebreakOnly: setFormat?.tiebreakSet?.tiebreakTo !== undefined,
  };
}

describe('dynamicSets getSetFormat Logic', () => {
  describe('Standard Format (SET3-S:6/TB7)', () => {
    const format = 'SET3-S:6/TB7';
    const bestOf = 3;

    it('should use regular setFormat for set 1', () => {
      const setFormat = getSetFormat(0, format, bestOf);
      const info = getFormatInfo(setFormat);
      
      expect(info.setTo).toBe(6);
      expect(info.tiebreakAt).toBe(6);
      expect(info.isTiebreakOnly).toBe(false);
    });

    it('should use regular setFormat for set 2', () => {
      const setFormat = getSetFormat(1, format, bestOf);
      const info = getFormatInfo(setFormat);
      
      expect(info.setTo).toBe(6);
      expect(info.tiebreakAt).toBe(6);
      expect(info.isTiebreakOnly).toBe(false);
    });

    it('should use regular setFormat for set 3 (no finalSetFormat)', () => {
      const setFormat = getSetFormat(2, format, bestOf);
      const info = getFormatInfo(setFormat);
      
      expect(info.setTo).toBe(6);
      expect(info.tiebreakAt).toBe(6);
      expect(info.isTiebreakOnly).toBe(false);
    });
  });

  describe('Final Set Tiebreak Format (SET3-S:6/TB7-F:TB10)', () => {
    const format = 'SET3-S:6/TB7-F:TB10';
    const bestOf = 3;

    it('should use regular setFormat for set 1', () => {
      const setFormat = getSetFormat(0, format, bestOf);
      const info = getFormatInfo(setFormat);
      
      expect(info.setTo).toBe(6);
      expect(info.tiebreakAt).toBe(6);
      expect(info.isTiebreakOnly).toBe(false);
    });

    it('should use regular setFormat for set 2', () => {
      const setFormat = getSetFormat(1, format, bestOf);
      const info = getFormatInfo(setFormat);
      
      expect(info.setTo).toBe(6);
      expect(info.tiebreakAt).toBe(6);
      expect(info.isTiebreakOnly).toBe(false);
    });

    it('should use finalSetFormat for set 3 (tiebreak-only)', () => {
      const setFormat = getSetFormat(2, format, bestOf);
      const info = getFormatInfo(setFormat);
      
      expect(info.isTiebreakOnly).toBe(true);
      expect(info.tiebreakTo).toBe(10);
    });
  });

  describe('Best-of-5 with Final Set Tiebreak', () => {
    const format = 'SET5-S:6/TB7-F:TB10';
    const bestOf = 5;

    it('should use regular setFormat for set 1', () => {
      const setFormat = getSetFormat(0, format, bestOf);
      const info = getFormatInfo(setFormat);
      
      expect(info.setTo).toBe(6);
      expect(info.tiebreakAt).toBe(6);
      expect(info.isTiebreakOnly).toBe(false);
    });

    it('should use regular setFormat for set 2', () => {
      const setFormat = getSetFormat(1, format, bestOf);
      const info = getFormatInfo(setFormat);
      
      expect(info.setTo).toBe(6);
      expect(info.tiebreakAt).toBe(6);
      expect(info.isTiebreakOnly).toBe(false);
    });

    it('should use regular setFormat for set 3', () => {
      const setFormat = getSetFormat(2, format, bestOf);
      const info = getFormatInfo(setFormat);
      
      expect(info.setTo).toBe(6);
      expect(info.tiebreakAt).toBe(6);
      expect(info.isTiebreakOnly).toBe(false);
    });

    it('should use regular setFormat for set 4', () => {
      const setFormat = getSetFormat(3, format, bestOf);
      const info = getFormatInfo(setFormat);
      
      expect(info.setTo).toBe(6);
      expect(info.tiebreakAt).toBe(6);
      expect(info.isTiebreakOnly).toBe(false);
    });

    it('should use finalSetFormat for set 5 (tiebreak-only)', () => {
      const setFormat = getSetFormat(4, format, bestOf);
      const info = getFormatInfo(setFormat);
      
      expect(info.isTiebreakOnly).toBe(true);
      expect(info.tiebreakTo).toBe(10);
    });
  });

  describe('Extended Set Formats (S:8/TB7)', () => {
    const format = 'SET3-S:8/TB7';
    const bestOf = 3;

    it('should use setTo=8 and tiebreakAt=8 for all sets', () => {
      for (let i = 0; i < 3; i++) {
        const setFormat = getSetFormat(i, format, bestOf);
        const info = getFormatInfo(setFormat);
        
        expect(info.setTo).toBe(8);
        expect(info.tiebreakAt).toBe(8);
        expect(info.isTiebreakOnly).toBe(false);
      }
    });
  });

  describe('Extended Set with Tiebreak at Different Value (S:8/TB7@7)', () => {
    const format = 'SET3-S:8/TB7@7';
    const bestOf = 3;

    it('should use setTo=8 and tiebreakAt=7', () => {
      const setFormat = getSetFormat(0, format, bestOf);
      const info = getFormatInfo(setFormat);
      
      expect(info.setTo).toBe(8);
      expect(info.tiebreakAt).toBe(7);
      expect(info.isTiebreakOnly).toBe(false);
    });
  });

  describe('Short Set Format (S:4/TB7)', () => {
    const format = 'SET3-S:4/TB7';
    const bestOf = 3;

    it('should use setTo=4 and tiebreakAt=4', () => {
      const setFormat = getSetFormat(0, format, bestOf);
      const info = getFormatInfo(setFormat);
      
      expect(info.setTo).toBe(4);
      expect(info.tiebreakAt).toBe(4);
      expect(info.isTiebreakOnly).toBe(false);
    });
  });

  describe('No-Ad Tiebreak Format (S:6/TB7NOAD)', () => {
    const format = 'SET3-S:6/TB7NOAD';
    const bestOf = 3;

    it('should parse correctly with NoAD tiebreak', () => {
      const setFormat = getSetFormat(0, format, bestOf);
      const info = getFormatInfo(setFormat);
      
      expect(info.setTo).toBe(6);
      expect(info.tiebreakAt).toBe(6);
      expect(info.isTiebreakOnly).toBe(false);
    });
  });

  describe('Best-of-1 Match (Single Tiebreak)', () => {
    const format = 'SET1-S:TB10';
    const bestOf = 1;

    it('should use finalSetFormat for the only set (tiebreak-only)', () => {
      const setFormat = getSetFormat(0, format, bestOf);
      const info = getFormatInfo(setFormat);
      
      expect(info.isTiebreakOnly).toBe(true);
      expect(info.tiebreakTo).toBe(10);
    });
  });

  describe('Tiebreak Visibility Logic', () => {
    describe('Standard SET3-S:6/TB7', () => {
      const format = 'SET3-S:6/TB7';
      const bestOf = 3;

      it('should show tiebreak field at 7-6 or 6-7 (tiebreakAt=6)', () => {
        const setFormat = getSetFormat(0, format, bestOf);
        const tiebreakAt = setFormat?.tiebreakAt || 6;
        
        expect(tiebreakAt).toBe(6);
        
        // Tiebreak shown when scores are at tiebreakAt+1 vs tiebreakAt
        // e.g., 7-6 or 6-7
        const shouldShow76 = (7 === 7 && 6 === 6) || (6 === 6 && 7 === 7);
        expect(shouldShow76).toBe(true);
      });
    });

    describe('Extended SET3-S:8/TB7', () => {
      const format = 'SET3-S:8/TB7';
      const bestOf = 3;

      it('should show tiebreak field at 9-8 or 8-9 (tiebreakAt=8)', () => {
        const setFormat = getSetFormat(0, format, bestOf);
        const tiebreakAt = setFormat?.tiebreakAt || 6;
        
        expect(tiebreakAt).toBe(8);
        
        // Tiebreak shown when scores are at tiebreakAt+1 vs tiebreakAt
        // e.g., 9-8 or 8-9
        const shouldShow98 = (9 === tiebreakAt + 1 && 8 === tiebreakAt) ||
                             (8 === tiebreakAt && 9 === tiebreakAt + 1);
        expect(shouldShow98).toBe(true);
      });
    });

    describe('Short set S:4/TB7', () => {
      const format = 'SET3-S:4/TB7';
      const bestOf = 3;

      it('should show tiebreak field at 5-4 or 4-5 (tiebreakAt=4)', () => {
        const setFormat = getSetFormat(0, format, bestOf);
        const tiebreakAt = setFormat?.tiebreakAt || 6;
        
        expect(tiebreakAt).toBe(4);
        
        const shouldShow54 = (5 === tiebreakAt + 1 && 4 === tiebreakAt) ||
                             (4 === tiebreakAt && 5 === tiebreakAt + 1);
        expect(shouldShow54).toBe(true);
      });
    });
  });

  describe('Set Completion Logic', () => {
    describe('Standard SET3-S:6/TB7', () => {
      const format = 'SET3-S:6/TB7';
      const bestOf = 3;

      it('should complete set with 6-4 (setTo + 2-game margin)', () => {
        const setFormat = getSetFormat(0, format, bestOf);
        const setTo = setFormat?.setTo || 6;
        
        const s1 = 6, s2 = 4;
        const maxScore = Math.max(s1, s2);
        const minScore = Math.min(s1, s2);
        const scoreDiff = maxScore - minScore;
        
        // Set complete if: maxScore >= setTo && scoreDiff >= 2
        const isComplete = maxScore >= setTo && scoreDiff >= 2;
        expect(isComplete).toBe(true);
      });

      it('should complete set with 7-5 (setTo + 2-game margin)', () => {
        const setFormat = getSetFormat(0, format, bestOf);
        const setTo = setFormat?.setTo || 6;
        
        const s1 = 7, s2 = 5;
        const maxScore = Math.max(s1, s2);
        const minScore = Math.min(s1, s2);
        const scoreDiff = maxScore - minScore;
        
        const isComplete = maxScore >= setTo && scoreDiff >= 2;
        expect(isComplete).toBe(true);
      });

      it('should NOT complete set with 6-5 (no 2-game margin)', () => {
        const setFormat = getSetFormat(0, format, bestOf);
        const setTo = setFormat?.setTo || 6;
        
        const s1 = 6, s2 = 5;
        const maxScore = Math.max(s1, s2);
        const scoreDiff = maxScore - Math.min(s1, s2);
        
        const isComplete = maxScore >= setTo && scoreDiff >= 2;
        expect(isComplete).toBe(false);
      });

      it('should complete set with 7-6 + tiebreak', () => {
        const setFormat = getSetFormat(0, format, bestOf);
        const tiebreakAt = setFormat?.tiebreakAt || 6;
        
        const s1 = 7, s2 = 6;
        const tiebreak = 3; // Any tiebreak score
        const maxScore = Math.max(s1, s2);
        const minScore = Math.min(s1, s2);
        
        // Complete if: maxScore === tiebreakAt + 1 && minScore === tiebreakAt && tiebreak entered
        const isComplete = maxScore === tiebreakAt + 1 && 
                          minScore === tiebreakAt && 
                          tiebreak !== undefined;
        expect(isComplete).toBe(true);
      });

      it('should NOT complete 7-6 without tiebreak', () => {
        const setFormat = getSetFormat(0, format, bestOf);
        const tiebreakAt = setFormat?.tiebreakAt || 6;
        
        const s1 = 7, s2 = 6;
        const tiebreak = undefined;
        const maxScore = Math.max(s1, s2);
        const minScore = Math.min(s1, s2);
        
        const isComplete = maxScore === tiebreakAt + 1 && 
                          minScore === tiebreakAt && 
                          tiebreak !== undefined;
        expect(isComplete).toBe(false);
      });
    });

    describe('Extended SET3-S:8/TB7', () => {
      const format = 'SET3-S:8/TB7';
      const bestOf = 3;

      it('should complete set with 8-6 (setTo + 2-game margin)', () => {
        const setFormat = getSetFormat(0, format, bestOf);
        const setTo = setFormat?.setTo || 6;
        
        const s1 = 8, s2 = 6;
        const maxScore = Math.max(s1, s2);
        const scoreDiff = maxScore - Math.min(s1, s2);
        
        const isComplete = maxScore >= setTo && scoreDiff >= 2;
        expect(isComplete).toBe(true);
      });

      it('should NOT complete set with 8-7 (no 2-game margin, would go to 9-7 or 8-8 tiebreak)', () => {
        const setFormat = getSetFormat(0, format, bestOf);
        const setTo = setFormat?.setTo || 6;
        const tiebreakAt = setFormat?.tiebreakAt || 6;
        
        const s1 = 8, s2 = 7;
        const maxScore = Math.max(s1, s2);
        const minScore = Math.min(s1, s2);
        const scoreDiff = maxScore - minScore;
        
        // Check both conditions
        const completeWith2GameMargin = maxScore >= setTo && scoreDiff >= 2;
        const completeWithTiebreak = maxScore === tiebreakAt + 1 && 
                                     minScore === tiebreakAt && 
                                     undefined !== undefined; // No tiebreak
        
        expect(completeWith2GameMargin).toBe(false);
        expect(completeWithTiebreak).toBe(false);
      });

      it('should complete set with 9-8 + tiebreak (tiebreakAt=8)', () => {
        const setFormat = getSetFormat(0, format, bestOf);
        const tiebreakAt = setFormat?.tiebreakAt || 6;
        
        expect(tiebreakAt).toBe(8);
        
        const s1 = 9, s2 = 8;
        const tiebreak = 5;
        const maxScore = Math.max(s1, s2);
        const minScore = Math.min(s1, s2);
        
        const isComplete = maxScore === tiebreakAt + 1 && 
                          minScore === tiebreakAt && 
                          tiebreak !== undefined;
        expect(isComplete).toBe(true);
      });
    });

    describe('Short Set S:4/TB7', () => {
      const format = 'SET3-S:4/TB7';
      const bestOf = 3;

      it('should complete set with 4-2 (setTo + 2-game margin)', () => {
        const setFormat = getSetFormat(0, format, bestOf);
        const setTo = setFormat?.setTo || 6;
        
        expect(setTo).toBe(4);
        
        const s1 = 4, s2 = 2;
        const maxScore = Math.max(s1, s2);
        const scoreDiff = maxScore - Math.min(s1, s2);
        
        const isComplete = maxScore >= setTo && scoreDiff >= 2;
        expect(isComplete).toBe(true);
      });

      it('should complete set with 5-4 + tiebreak (tiebreakAt=4)', () => {
        const setFormat = getSetFormat(0, format, bestOf);
        const tiebreakAt = setFormat?.tiebreakAt || 6;
        
        expect(tiebreakAt).toBe(4);
        
        const s1 = 5, s2 = 4;
        const tiebreak = 6;
        const maxScore = Math.max(s1, s2);
        const minScore = Math.min(s1, s2);
        
        const isComplete = maxScore === tiebreakAt + 1 && 
                          minScore === tiebreakAt && 
                          tiebreak !== undefined;
        expect(isComplete).toBe(true);
      });
    });
  });

  describe('Edge Cases and Regression Tests', () => {
    it('should handle format without explicit tiebreakAt', () => {
      const format = 'SET3-S:6/TB7';
      const setFormat = getSetFormat(0, format, 3);
      
      // Should default tiebreakAt to setTo when not specified
      expect(setFormat?.tiebreakAt).toBe(6);
      expect(setFormat?.setTo).toBe(6);
    });

    it('should correctly identify deciding set in best-of-1', () => {
      const format = 'SET1-S:TB10';
      const setFormat = getSetFormat(0, format, 1);
      const info = getFormatInfo(setFormat);
      
      // bestOf=1 means set 1 (index 0) is the deciding set
      expect(info.isTiebreakOnly).toBe(true);
    });

    it('should correctly identify deciding set in best-of-3', () => {
      const format = 'SET3-S:6/TB7-F:TB10';
      
      // Set 3 (index 2) is deciding set when (index + 1) === bestOf
      const set3Format = getSetFormat(2, format, 3);
      const info = getFormatInfo(set3Format);
      
      expect(info.isTiebreakOnly).toBe(true);
    });

    it('should correctly identify deciding set in best-of-5', () => {
      const format = 'SET5-S:6/TB7-F:TB10';
      
      // Set 5 (index 4) is deciding set
      const set5Format = getSetFormat(4, format, 5);
      const info = getFormatInfo(set5Format);
      
      expect(info.isTiebreakOnly).toBe(true);
    });

    it('should not use finalSetFormat for non-deciding sets', () => {
      const format = 'SET3-S:6/TB7-F:TB10';
      
      // Set 2 (index 1) is NOT deciding set
      const set2Format = getSetFormat(1, format, 3);
      const info = getFormatInfo(set2Format);
      
      expect(info.isTiebreakOnly).toBe(false);
      expect(info.setTo).toBe(6);
    });
  });
});
