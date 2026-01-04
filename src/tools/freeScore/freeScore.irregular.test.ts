import { describe, it, expect } from 'vitest';
import { parseScore } from './freeScore';
import { matchUpStatusConstants } from 'tods-competition-factory';

const {
  RETIRED,
  WALKOVER,
  DEFAULTED,
  SUSPENDED,
  CANCELLED,
  INCOMPLETE,
  DEAD_RUBBER,
  IN_PROGRESS,
  AWAITING_RESULT,
} = matchUpStatusConstants;

describe('freeScore Parser - Irregular Endings', () => {
  describe('RETIRED', () => {
    it('should detect "ret" after score', () => {
      const result = parseScore('6-4 3-2 ret', 'SET3-S:6/TB7');
      
      expect(result.valid).toBe(true);
      expect(result.matchUpStatus).toBe(RETIRED);
      expect(result.sets).toHaveLength(2);
      expect(result.matchComplete).toBe(false);
      expect(result.incomplete).toBe(true);
    });

    it('should detect "RET" (uppercase)', () => {
      const result = parseScore('6-4 3-2 RET', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(RETIRED);
    });

    it('should detect "retired" (full word)', () => {
      const result = parseScore('6-4 3-2 retired', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(RETIRED);
    });

    it('should detect "retire" (partial word)', () => {
      const result = parseScore('6-4 3-2 retire', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(RETIRED);
    });

    it('should detect "reti" (partial word)', () => {
      const result = parseScore('6-4 3-2 reti', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(RETIRED);
    });

    it('should handle retired without preceding score', () => {
      const result = parseScore('ret', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(RETIRED);
      expect(result.sets).toHaveLength(0);
    });
  });

  describe('WALKOVER', () => {
    it('should detect "wo" and remove preceding score', () => {
      const result = parseScore('6-4 wo', 'SET3-S:6/TB7');
      
      expect(result.valid).toBe(true);
      expect(result.matchUpStatus).toBe(WALKOVER);
      expect(result.sets).toHaveLength(0); // Score removed for walkover
      expect(result.matchComplete).toBe(false);
    });

    it('should detect "WO" (uppercase)', () => {
      const result = parseScore('WO', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(WALKOVER);
      expect(result.sets).toHaveLength(0);
    });

    it('should detect "w/o" (with slash)', () => {
      const result = parseScore('w/o', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(WALKOVER);
    });

    it('should detect "walkover" (full word)', () => {
      const result = parseScore('walkover', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(WALKOVER);
    });

    it('should detect "walk" (partial word)', () => {
      const result = parseScore('walk', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(WALKOVER);
    });

    it('should detect "walko" (partial word)', () => {
      const result = parseScore('walko', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(WALKOVER);
    });
  });

  describe('DEFAULTED', () => {
    it('should detect "def" after score', () => {
      const result = parseScore('6-4 3-2 def', 'SET3-S:6/TB7');
      
      expect(result.valid).toBe(true);
      expect(result.matchUpStatus).toBe(DEFAULTED);
      expect(result.sets).toHaveLength(2);
      expect(result.matchComplete).toBe(false);
      expect(result.incomplete).toBe(true);
    });

    it('should detect "DEF" (uppercase)', () => {
      const result = parseScore('DEF', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(DEFAULTED);
    });

    it('should detect "defaulted" (full word)', () => {
      const result = parseScore('6-4 defaulted', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(DEFAULTED);
    });

    it('should detect "default" (partial word)', () => {
      const result = parseScore('default', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(DEFAULTED);
    });

    it('should detect "defau" (partial word)', () => {
      const result = parseScore('defau', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(DEFAULTED);
    });
  });

  describe('SUSPENDED', () => {
    it('should detect "susp" after score', () => {
      const result = parseScore('6-4 3-2 susp', 'SET3-S:6/TB7');
      
      expect(result.valid).toBe(true);
      expect(result.matchUpStatus).toBe(SUSPENDED);
      expect(result.sets).toHaveLength(2); // Score preserved
      expect(result.matchComplete).toBe(false);
      expect(result.incomplete).toBe(true);
    });

    it('should detect "SUSPENDED" (uppercase)', () => {
      const result = parseScore('6-4 SUSPENDED', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(SUSPENDED);
      expect(result.sets).toHaveLength(1);
    });

    it('should detect "suspend" (partial word)', () => {
      const result = parseScore('6-4 suspend', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(SUSPENDED);
    });

    it('should handle suspended without score', () => {
      const result = parseScore('suspended', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(SUSPENDED);
      expect(result.sets).toHaveLength(0);
    });
  });

  describe('CANCELLED', () => {
    it('should detect "canc" and remove score', () => {
      const result = parseScore('6-4 canc', 'SET3-S:6/TB7');
      
      expect(result.valid).toBe(true);
      expect(result.matchUpStatus).toBe(CANCELLED);
      expect(result.sets).toHaveLength(0); // Score removed (match won't happen)
      expect(result.matchComplete).toBe(false);
    });

    it('should detect "CANCELLED" (British spelling)', () => {
      const result = parseScore('CANCELLED', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(CANCELLED);
      expect(result.sets).toHaveLength(0);
    });

    it('should detect "canceled" (American spelling)', () => {
      const result = parseScore('canceled', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(CANCELLED);
      expect(result.sets).toHaveLength(0);
    });

    it('should detect "cancel" (partial word)', () => {
      const result = parseScore('6-4 cancel', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(CANCELLED);
      expect(result.sets).toHaveLength(0);
    });
  });

  describe('INCOMPLETE', () => {
    it('should detect "inc" after score', () => {
      const result = parseScore('6-4 3-2 inc', 'SET3-S:6/TB7');
      
      expect(result.valid).toBe(true);
      expect(result.matchUpStatus).toBe(INCOMPLETE);
      expect(result.sets).toHaveLength(2); // Score preserved
      expect(result.matchComplete).toBe(false);
      expect(result.incomplete).toBe(true);
    });

    it('should detect "INCOMPLETE" (uppercase)', () => {
      const result = parseScore('INCOMPLETE', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(INCOMPLETE);
      expect(result.sets).toHaveLength(0);
    });

    it('should detect "incomplet" (partial word)', () => {
      const result = parseScore('6-4 incomplet', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(INCOMPLETE);
    });
  });

  describe('DEAD RUBBER', () => {
    it('should detect "dead" and remove score', () => {
      const result = parseScore('6-4 dead', 'SET3-S:6/TB7');
      
      expect(result.valid).toBe(true);
      expect(result.matchUpStatus).toBe(DEAD_RUBBER);
      expect(result.sets).toHaveLength(0); // Score removed (match not played)
      expect(result.matchComplete).toBe(false);
    });

    it('should detect "DEAD RUBBER" (full phrase)', () => {
      const result = parseScore('DEAD RUBBER', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(DEAD_RUBBER);
      expect(result.sets).toHaveLength(0);
    });

    it('should detect "dead rubber" with score before', () => {
      const result = parseScore('6-4 3-2 dead rubber', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(DEAD_RUBBER);
      expect(result.sets).toHaveLength(0);
    });
  });

  describe('IN PROGRESS', () => {
    it('should detect "in prog" after score', () => {
      const result = parseScore('6-4 3-2 in prog', 'SET3-S:6/TB7');
      
      expect(result.valid).toBe(true);
      expect(result.matchUpStatus).toBe(IN_PROGRESS);
      expect(result.sets).toHaveLength(2); // Score preserved
      expect(result.matchComplete).toBe(false);
      expect(result.incomplete).toBe(true);
    });

    it('should detect "IN PROGRESS" (full phrase)', () => {
      const result = parseScore('6-4 IN PROGRESS', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(IN_PROGRESS);
      expect(result.sets).toHaveLength(1);
    });

    it('should detect "in progress" lowercase', () => {
      const result = parseScore('in progress', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(IN_PROGRESS);
      expect(result.sets).toHaveLength(0);
    });
  });

  describe('AWAITING RESULT', () => {
    it('should detect "await" after score', () => {
      const result = parseScore('6-4 6-3 await', 'SET3-S:6/TB7');
      
      expect(result.valid).toBe(true);
      expect(result.matchUpStatus).toBe(AWAITING_RESULT);
      expect(result.sets).toHaveLength(2); // Score preserved
      expect(result.matchComplete).toBe(false);
    });

    it('should detect "AWAITING RESULT" (full phrase)', () => {
      const result = parseScore('AWAITING RESULT', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(AWAITING_RESULT);
      expect(result.sets).toHaveLength(0);
    });

    it('should detect "awaiting" (partial)', () => {
      const result = parseScore('6-4 awaiting', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(AWAITING_RESULT);
    });
  });

  describe('Mixed scenarios', () => {
    it('should handle irregular ending with spaces', () => {
      const result = parseScore('6-4 3-2   retired', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(RETIRED);
      expect(result.sets).toHaveLength(2);
    });

    it('should handle irregular ending with various separators', () => {
      const result = parseScore('6-4;3-2 - ret', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBe(RETIRED);
      expect(result.sets).toHaveLength(2);
    });

    it('should not confuse "wo" in middle of input', () => {
      // This would only match if "wo" is at start of remaining chars after score
      const result = parseScore('6-4 6-3', 'SET3-S:6/TB7');
      
      expect(result.matchUpStatus).toBeUndefined();
      expect(result.sets).toHaveLength(2);
    });

    it('should distinguish between status types that preserve vs remove score', () => {
      // Score preserved
      const retired = parseScore('6-4 ret', 'SET3-S:6/TB7');
      expect(retired.sets).toHaveLength(1);
      
      const suspended = parseScore('6-4 susp', 'SET3-S:6/TB7');
      expect(suspended.sets).toHaveLength(1);
      
      // Score removed
      const walkover = parseScore('6-4 wo', 'SET3-S:6/TB7');
      expect(walkover.sets).toHaveLength(0);
      
      const cancelled = parseScore('6-4 canc', 'SET3-S:6/TB7');
      expect(cancelled.sets).toHaveLength(0);
      
      const deadRubber = parseScore('6-4 dead', 'SET3-S:6/TB7');
      expect(deadRubber.sets).toHaveLength(0);
    });
  });
});
