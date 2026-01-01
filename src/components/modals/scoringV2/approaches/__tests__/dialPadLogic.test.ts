/**
 * Test suite for dial pad score entry logic
 * Data-driven tests for key sequences and expected outputs
 */

import { describe, it, expect } from 'vitest';
import { formatScoreString } from '../dialPadLogic';
import { MATCH_FORMATS } from '../../../../../constants/matchUpFormats';

type TestCase = {
  name: string;
  keySequence: (number | string)[];
  expectedScoreString: string;
  matchUpFormat: string;
};

const testCases: TestCase[] = [
  // Basic SET3 scores
  {
    name: 'should handle 6-4 6-4',
    keySequence: [6, 4, 6, 4],
    expectedScoreString: '6-4 6-4',
    matchUpFormat: MATCH_FORMATS.SET3_S6_TB7,
  },
  {
    name: 'should handle 3-6 3-6',
    keySequence: [3, 6, 3, 6],
    expectedScoreString: '3-6 3-6',
    matchUpFormat: MATCH_FORMATS.SET3_S6_TB7,
  },
  {
    name: 'should handle 7-5 6-3',
    keySequence: [7, 5, 6, 3],
    expectedScoreString: '7-5 6-3',
    matchUpFormat: MATCH_FORMATS.SET3_S6_TB7,
  },
  {
    name: 'should handle 6-0 6-1',
    keySequence: [6, 0, 6, 1],
    expectedScoreString: '6-0 6-1',
    matchUpFormat: MATCH_FORMATS.SET3_S6_TB7,
  },
  
  // Tiebreak sets (single digit tiebreak score)
  {
    name: 'should handle 6-7 with tiebreak 3',
    keySequence: [6, 7, 3],
    expectedScoreString: '6-7(3)',
    matchUpFormat: MATCH_FORMATS.SET3_S6_TB7,
  },
  {
    name: 'should handle 7-6 with tiebreak 5',
    keySequence: [7, 6, 5],
    expectedScoreString: '7-6(5)',
    matchUpFormat: MATCH_FORMATS.SET3_S6_TB7,
  },
  {
    name: 'should handle 6-7 with multi-digit tiebreak 18',
    keySequence: [6, 7, 1, 8],
    expectedScoreString: '6-7(18)',
    matchUpFormat: MATCH_FORMATS.SET3_S6_TB7,
  },
  
  // Single tiebreak set
  {
    name: 'should handle TB10 format 12-10',
    keySequence: [1, 2, 1, 0],
    expectedScoreString: '12-10',
    matchUpFormat: MATCH_FORMATS.SET1_S_TB10,
  },
  
  // SET5 format
  {
    name: 'should handle SET5 6-4 6-4',
    keySequence: [6, 4, 6, 4],
    expectedScoreString: '6-4 6-4',
    matchUpFormat: MATCH_FORMATS.SET5_S6_TB7,
  },
  
  // Tiebreak with minus key separator
  {
    name: 'should handle 6-7(3) 3-6 with minus key separator',
    keySequence: [6, 7, 3, '-', 3, 6],
    expectedScoreString: '6-7(3) 3-6',
    matchUpFormat: MATCH_FORMATS.SET3_S6_TB7,
  },
];

describe('Dial Pad Score Entry Logic', () => {
  testCases.forEach(testCase => {
    it(testCase.name, () => {
      // Join keySequence, but preserve '-' as a character
      const digits = testCase.keySequence.map(k => k.toString()).join('');
      
      const result = formatScoreString(digits, { matchUpFormat: testCase.matchUpFormat });
      expect(result).toBe(testCase.expectedScoreString);
    });
  });
});
