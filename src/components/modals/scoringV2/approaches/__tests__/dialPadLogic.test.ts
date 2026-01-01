/**
 * Test suite for dial pad score entry logic
 * Data-driven tests for key sequences and expected outputs
 */

import { describe, it, expect } from 'vitest';
import { formatScoreString } from '../dialPadLogic';

type TestCase = {
  name: string;
  keySequence: number[];
  expectedScoreString: string;
  setTo?: number;
  tiebreakAt?: number;
};

const testCases: TestCase[] = [
  // Basic scores
  {
    name: 'should handle 6-4 6-4',
    keySequence: [6, 4, 6, 4],
    expectedScoreString: '6-4 6-4',
  },
  {
    name: 'should handle 3-6 3-6',
    keySequence: [3, 6, 3, 6],
    expectedScoreString: '3-6 3-6',
  },
  {
    name: 'should handle 7-5 6-3',
    keySequence: [7, 5, 6, 3],
    expectedScoreString: '7-5 6-3',
  },
  {
    name: 'should handle 6-0 6-1',
    keySequence: [6, 0, 6, 1],
    expectedScoreString: '6-0 6-1',
  },
  
  // Tiebreak sets (two-digit tiebreak scores: 03, 06, 07, etc.)
  {
    name: 'should handle 6-7 with tiebreak 03-06',
    keySequence: [6, 7, 0, 3, 0, 6],
    expectedScoreString: '6-7(03-06)',
  },
  {
    name: 'should handle 7-6 with tiebreak 05-03',
    keySequence: [7, 6, 0, 5, 0, 3],
    expectedScoreString: '7-6(05-03)',
  },
  {
    name: 'should handle 6-6 tiebreak 07-05',
    keySequence: [6, 6, 0, 7, 0, 5],
    expectedScoreString: '6-6(07-05)',
  },
  
  // Multi-digit scores
  {
    name: 'should handle 10-8',
    keySequence: [1, 0, 8],
    expectedScoreString: '10-8',
    setTo: 8,
    tiebreakAt: 8,
  },
  {
    name: 'should handle 12-10',
    keySequence: [1, 2, 1, 0],
    expectedScoreString: '12-10',
    setTo: 10,
    tiebreakAt: 10,
  },
];

describe('Dial Pad Score Entry Logic', () => {
  testCases.forEach(testCase => {
    it(testCase.name, () => {
      const digits = testCase.keySequence.join('');
      const setTo = testCase.setTo || 6;
      const tiebreakAt = testCase.tiebreakAt || 6;
      
      const result = formatScoreString(digits, { setTo, tiebreakAt });
      expect(result).toBe(testCase.expectedScoreString);
    });
  });
});
