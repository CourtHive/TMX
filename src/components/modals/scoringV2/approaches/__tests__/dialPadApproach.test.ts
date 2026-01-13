/**
 * Tests for dialPad approach - focuses on testable pure functions
 * 
 * Note: Full dialPad UI logic is complex and tightly coupled to DOM.
 * These tests cover the extractable pure logic that was fixed today.
 */

 

import { describe, it, expect } from 'vitest';

/**
 * scoreToDigits - Convert score object back to digit string for dialPad
 * This is the function that loads existing scores into the dialPad
 */
function scoreToDigits(scoreObject: any): string {
  if (!scoreObject?.sets || scoreObject.sets.length === 0) return '';
  
  const digitParts: string[] = [];
  
  scoreObject.sets.forEach((set: any, index: number) => {
    // Add separator between sets (use space for simplicity)
    if (index > 0) {
      digitParts.push(' ');
    }
    
    // Add game scores
    digitParts.push(set.side1Score?.toString() || '0', set.side2Score?.toString() || '0');
    
    // Add tiebreak scores if present
    if (set.side1TiebreakScore !== undefined || set.side2TiebreakScore !== undefined) {
      // For dialPad, we use minus to separate tiebreak
      // The losing score is what we track
      const losingScore = set.winningSide === 1 
        ? set.side2TiebreakScore 
        : set.side1TiebreakScore;
      
      if (losingScore !== undefined) {
        digitParts.push('-', losingScore.toString());
      }
    }
  });
  
  return digitParts.join('');
}

describe('dialPadApproach - scoreToDigits', () => {
  it('returns empty string for empty score object', () => {
    expect(scoreToDigits(null)).toBe('');
    expect(scoreToDigits({})).toBe('');
    expect(scoreToDigits({ sets: [] })).toBe('');
  });

  it('converts simple score to digits', () => {
    const score = {
      sets: [
        { side1Score: 6, side2Score: 3, winningSide: 1 }
      ]
    };
    expect(scoreToDigits(score)).toBe('63');
  });

  it('converts two-set score to digits with space separator', () => {
    const score = {
      sets: [
        { side1Score: 6, side2Score: 3, winningSide: 1 },
        { side1Score: 6, side2Score: 4, winningSide: 1 }
      ]
    };
    expect(scoreToDigits(score)).toBe('63 64');
  });

  it('converts score with tiebreak - side1 wins', () => {
    const score = {
      sets: [
        { 
          side1Score: 7, 
          side2Score: 6, 
          side1TiebreakScore: 7,
          side2TiebreakScore: 3,
          winningSide: 1 
        }
      ]
    };
    // Losing score (3) is tracked for dialPad
    expect(scoreToDigits(score)).toBe('76-3');
  });

  it('converts score with tiebreak - side2 wins', () => {
    const score = {
      sets: [
        { 
          side1Score: 6, 
          side2Score: 7, 
          side1TiebreakScore: 4,
          side2TiebreakScore: 7,
          winningSide: 2 
        }
      ]
    };
    // Losing score (4) is tracked for dialPad
    expect(scoreToDigits(score)).toBe('67-4');
  });

  it('converts multi-set score with tiebreaks', () => {
    const score = {
      sets: [
        { 
          side1Score: 7, 
          side2Score: 6, 
          side1TiebreakScore: 7,
          side2TiebreakScore: 3,
          winningSide: 1 
        },
        { 
          side1Score: 6, 
          side2Score: 7, 
          side1TiebreakScore: 5,
          side2TiebreakScore: 7,
          winningSide: 2 
        }
      ]
    };
    expect(scoreToDigits(score)).toBe('76-3 67-5');
  });

  it('handles RETIRED score with partial set (5-2)', () => {
    const score = {
      sets: [
        { side1Score: 5, side2Score: 2, winningSide: 1 }
      ]
    };
    expect(scoreToDigits(score)).toBe('52');
  });

  it('handles incomplete set without winningSide', () => {
    const score = {
      sets: [
        { side1Score: 4, side2Score: 3 }
      ]
    };
    expect(scoreToDigits(score)).toBe('43');
  });

  it('handles missing scores as 0', () => {
    const score = {
      sets: [
        { side1Score: undefined, side2Score: 3 }
      ]
    };
    expect(scoreToDigits(score)).toBe('03');
  });
});

describe('dialPadApproach - integration scenarios', () => {
  it('scoreToDigits handles COMPLETED score (6-3 6-3)', () => {
    const score = {
      sets: [
        { side1Score: 6, side2Score: 3, winningSide: 1, setNumber: 1 },
        { side1Score: 6, side2Score: 3, winningSide: 1, setNumber: 2 }
      ],
      scoreStringSide1: '6-3 6-3',
      scoreStringSide2: '3-6 3-6'
    };
    expect(scoreToDigits(score)).toBe('63 63');
  });

  it('scoreToDigits handles RETIRED score with incomplete set', () => {
    const score = {
      sets: [
        { side1Score: 5, side2Score: 2, winningSide: 1, setNumber: 1 }
      ],
      scoreStringSide1: '5-2',
      scoreStringSide2: '2-5'
    };
    expect(scoreToDigits(score)).toBe('52');
  });

  it('scoreToDigits handles TB9 tiebreak (S:5/TB9@4 format)', () => {
    const score = {
      sets: [
        { 
          side1Score: 4, 
          side2Score: 5, 
          side1TiebreakScore: 3,
          side2TiebreakScore: 9,
          winningSide: 2,
          setNumber: 1 
        }
      ]
    };
    // Losing score is 3
    expect(scoreToDigits(score)).toBe('45-3');
  });
});
