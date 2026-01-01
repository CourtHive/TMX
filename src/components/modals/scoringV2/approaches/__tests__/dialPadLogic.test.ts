/**
 * Test suite for dial pad score entry logic
 * Tests key sequences and expected score outputs
 */

import { describe, it, expect } from 'vitest';

type Phase = 'side1' | 'side2' | 'tiebreak_side1' | 'tiebreak_side2';

type SetScore = {
  side1Score?: number;
  side2Score?: number;
  side1TiebreakScore?: number;
  side2TiebreakScore?: number;
  winningSide?: number;
};

type EntryState = {
  currentSetIndex: number;
  currentPhase: Phase;
  pendingDigits: string;
  completedSets: SetScore[];
  tempSide1?: number;
  tempSide2?: number;
  tempTiebreakSide1?: number;
};

/**
 * Process a sequence of key entries and return the resulting score string
 */
function processKeySequence(keys: (number | '-')[], setTo: number = 6, tiebreakAt: number = 6, bestOf: number = 3): string {
  const state: EntryState = {
    currentSetIndex: 0,
    currentPhase: 'side1',
    pendingDigits: '',
    completedSets: [],
  };

  // Helper functions
  const shouldEnterTiebreak = (side1: number, side2: number): boolean => {
    if (side1 === tiebreakAt && side2 === tiebreakAt) return true;
    if (side1 === tiebreakAt + 1 && side2 === tiebreakAt) return true;
    if (side2 === tiebreakAt + 1 && side1 === tiebreakAt) return true;
    return false;
  };

  const isSetComplete = (side1: number, side2: number): boolean => {
    const higher = Math.max(side1, side2);
    const lower = Math.min(side1, side2);
    return higher >= setTo && higher - lower >= 2;
  };

  // Process each key
  for (const key of keys) {
    if (key === '-') {
      // Minus key - advance to next phase/element
      if (state.currentPhase === 'side1' && state.pendingDigits) {
        state.tempSide1 = parseInt(state.pendingDigits);
        state.pendingDigits = '';
        state.currentPhase = 'side2';
      } else if (state.currentPhase === 'side2' && state.pendingDigits) {
        const side1 = state.tempSide1!;
        const side2 = parseInt(state.pendingDigits);
        state.tempSide2 = side2;
        state.pendingDigits = '';
        
        if (shouldEnterTiebreak(side1, side2)) {
          state.currentPhase = 'tiebreak_side1';
        } else {
          // Complete the set
          state.completedSets.push({
            side1Score: side1,
            side2Score: side2,
            winningSide: side1 > side2 ? 1 : 2,
          });
          state.currentSetIndex++;
          state.currentPhase = 'side1';
          delete state.tempSide1;
          delete state.tempSide2;
        }
      } else if (state.currentPhase === 'tiebreak_side1' && state.pendingDigits) {
        state.tempTiebreakSide1 = parseInt(state.pendingDigits);
        state.pendingDigits = '';
        state.currentPhase = 'tiebreak_side2';
      } else if (state.currentPhase === 'tiebreak_side2' && state.pendingDigits) {
        // Complete tiebreak set
        state.completedSets.push({
          side1Score: state.tempSide1!,
          side2Score: state.tempSide2!,
          side1TiebreakScore: state.tempTiebreakSide1!,
          side2TiebreakScore: parseInt(state.pendingDigits),
          winningSide: state.tempTiebreakSide1! > parseInt(state.pendingDigits) ? 1 : 2,
        });
        state.currentSetIndex++;
        state.currentPhase = 'side1';
        state.pendingDigits = '';
        delete state.tempSide1;
        delete state.tempSide2;
        delete state.tempTiebreakSide1;
      }
    } else {
      // Number key
      state.pendingDigits += key.toString();
    }
  }

  // Format the score
  return state.completedSets
    .map(set => {
      let str = `${set.side1Score}-${set.side2Score}`;
      if (set.side1TiebreakScore !== undefined || set.side2TiebreakScore !== undefined) {
        str += `(${set.side1TiebreakScore}-${set.side2TiebreakScore})`;
      }
      return str;
    })
    .join(' ');
}

describe('Dial Pad Score Entry Logic', () => {
  describe('Basic score entry', () => {
    it('should handle 6-4 6-4', () => {
      const result = processKeySequence([6, '-', 4, '-', 6, '-', 4, '-']);
      expect(result).toBe('6-4 6-4');
    });

    it('should handle 3-6 3-6', () => {
      const result = processKeySequence([3, '-', 6, '-', 3, '-', 6, '-']);
      expect(result).toBe('3-6 3-6');
    });

    it('should handle 7-5 6-3', () => {
      const result = processKeySequence([7, '-', 5, '-', 6, '-', 3, '-']);
      expect(result).toBe('7-5 6-3');
    });

    it('should handle 6-0 6-1', () => {
      const result = processKeySequence([6, '-', 0, '-', 6, '-', 1, '-']);
      expect(result).toBe('6-0 6-1');
    });
  });

  describe('Tiebreak sets', () => {
    it('should handle 6-7(3) 6-3 7-6(4)', () => {
      const result = processKeySequence([6, '-', 7, '-', 3, '-', 6, '-', 3, '-', 7, '-', 6, '-', 4, '-']);
      expect(result).toBe('6-7(3-6) 6-3 7-6(4)');
    });

    it('should handle 7-6(5) 6-4', () => {
      const result = processKeySequence([7, '-', 6, '-', 5, '-', 3, '-', 6, '-', 4, '-']);
      expect(result).toBe('7-6(5-3) 6-4');
    });

    it('should handle 6-6 tiebreak', () => {
      const result = processKeySequence([6, '-', 6, '-', 7, '-', 5, '-']);
      expect(result).toBe('6-6(7-5)');
    });
  });

  describe('Multi-digit scores', () => {
    it('should handle 10-8 scores', () => {
      const result = processKeySequence([1, 0, '-', 8, '-'], 8, 8);
      expect(result).toBe('10-8');
    });

    it('should handle 12-10 scores', () => {
      const result = processKeySequence([1, 2, '-', 1, 0, '-'], 10, 10);
      expect(result).toBe('12-10');
    });
  });
});
