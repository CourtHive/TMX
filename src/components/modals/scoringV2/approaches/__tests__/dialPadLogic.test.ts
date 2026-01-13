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

  // Single tiebreak set (TB10 format requires brackets)
  {
    name: 'should handle TB10 format 12-10',
    keySequence: [1, 2, '-', 1, 0],
    expectedScoreString: '[12-10]',
    matchUpFormat: MATCH_FORMATS.SET1_S_TB10,
  },
  {
    name: 'should handle TB10 format 11-1 (side 1 wins)',
    keySequence: [1, 1, '-', 1],
    expectedScoreString: '[11-1]',
    matchUpFormat: MATCH_FORMATS.SET1_S_TB10,
  },
  {
    name: 'should handle TB10 format 11-13 (side 2 wins)',
    keySequence: [1, 1, '-', 1, 3],
    expectedScoreString: '[11-13]',
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

  // Invalid score - incomplete first set
  {
    name: 'should not advance to second set with incomplete first set',
    keySequence: [3, 3, 3, 3],
    expectedScoreString: '3-3',
    matchUpFormat: MATCH_FORMATS.SET3_S6_TB7,
  },

  // Invalid score - side2 > setTo but side1 < setTo-1
  {
    name: 'should coerce side2 DOWN to setTo when side2 > setTo and side1 < setTo-1',
    keySequence: [3, 7],
    expectedScoreString: '3-6',
    matchUpFormat: 'SET3-S:6',
  },

  // Invalid score - side2 exceeds setTo+1, should coerce side2 DOWN to setTo
  {
    name: 'should coerce side2 DOWN to setTo when side2 > setTo+1',
    keySequence: [3, 9],
    expectedScoreString: '3-6',
    matchUpFormat: 'SET3-S:6',
  },

  // Invalid score - side2 equals setTo+2, should coerce side2 DOWN to setTo
  {
    name: 'should coerce side2 DOWN to setTo when side2 = setTo+2',
    keySequence: [3, 8],
    expectedScoreString: '3-6',
    matchUpFormat: 'SET3-S:6',
  },

  // Minus key after side1 should be ignored (already advanced to side2)
  {
    name: 'should ignore minus after completing side1',
    keySequence: [6, '-', 7],
    expectedScoreString: '6-7',
    matchUpFormat: 'SET3-S:6',
  },

  // Minus key after tiebreak - smart detection of new set vs tb2
  // If next digits look like the start of a new set (e.g., 6-7), close tiebreak
  // Otherwise, parse as tb2
  {
    name: 'should close tiebreak when next digits look like new set 6-7',
    keySequence: [6, 7, 3, '-', 6, 7, 3],
    expectedScoreString: '6-7(3) 6-7(3)',
    matchUpFormat: 'SET3-S:6',
  },
  {
    name: 'should close tiebreak when next digits look like new set 6-3',
    keySequence: [6, 7, 3, '-', 6, 3],
    expectedScoreString: '6-7(3) 6-3',
    matchUpFormat: 'SET3-S:6',
  },
  {
    name: 'should allow multi-digit tiebreak scores',
    keySequence: [7, 6, 1, 2, '-', 4, 6],
    expectedScoreString: '7-6(12) 4-6',
    matchUpFormat: 'SET3-S:6',
  },

  // Final set tiebreak format (F:TB10) - third set is tiebreak-only
  // Note: User MUST type minus explicitly for tiebreak-only sets
  {
    name: 'should handle SET3 F:TB10 complete match 3-6 6-3 [8-10]',
    matchUpFormat: MATCH_FORMATS.SET3_S6_TB7_F_TB10,
    keySequence: [3, 6, 6, 3, 8, '-', 1, 0],
    expectedScoreString: '3-6 6-3 [8-10]',
  },
  {
    name: 'should handle SET3 F:TB10 complete match 6-1 7-5 [11-9]',
    matchUpFormat: MATCH_FORMATS.SET3_S6_TB7_F_TB10,
    keySequence: [6, 1, 7, 5, 1, 1, '-', 9],
    expectedScoreString: '6-1 7-5 [11-9]',
  },
  {
    name: 'should handle SET3 F:TB10 incomplete third set 1-6 7-5 9',
    matchUpFormat: MATCH_FORMATS.SET3_S6_TB7_F_TB10,
    keySequence: [1, 6, 7, 5, 9],
    expectedScoreString: '1-6 7-5 9',
  },
  {
    name: 'should handle SET3 F:TB10 third set with minus (trailing minus not shown)',
    matchUpFormat: MATCH_FORMATS.SET3_S6_TB7_F_TB10,
    keySequence: [1, 6, 7, 5, 9, '-'],
    expectedScoreString: '1-6 7-5 9',
  },
  {
    name: 'should handle SET3 F:TB10 extended tiebreak 6-4 4-6 [11-13]',
    matchUpFormat: MATCH_FORMATS.SET3_S6_TB7_F_TB10,
    keySequence: [6, 4, 4, 6, 1, 1, '-', 1, 3],
    expectedScoreString: '6-4 4-6 [11-13]',
  },

  // Final set tiebreak format (F:TB7) - third set is tiebreak-only
  {
    name: 'should handle SET3 F:TB7 complete match 6-3 4-6 [7-5]',
    keySequence: [6, 3, 4, 6, 7, '-', 5],
    expectedScoreString: '6-3 4-6 [7-5]',
    matchUpFormat: 'SET3-S:6/TB7-F:TB7',
  },
  {
    name: 'should handle SET3 F:TB7 with set tiebreaks and final TB7 [9-7]',
    keySequence: [7, 6, 5, '-', 6, 7, 3, '-', 9, '-', 7],
    expectedScoreString: '7-6(5) 6-7(3) [9-7]',
    matchUpFormat: 'SET3-S:6/TB7-F:TB7',
  },

  // SET5 with final set tiebreak (F:TB10)
  // Note: For realistic 5-set matches, dialPad auto-parses consecutive digits
  // These tests verify compact digit sequences work correctly
  {
    name: 'should handle SET3 F:TB10 (simpler case) 6-4 4-6 [10-8]',
    matchUpFormat: MATCH_FORMATS.SET3_S6_TB7_F_TB10,
    keySequence: [6, 4, 4, 6, 1, 0, '-', 8],
    expectedScoreString: '6-4 4-6 [10-8]',
  },
];

describe('Dial Pad Score Entry Logic', () => {
  testCases.forEach((testCase) => {
    it(testCase.name, () => {
      // Join keySequence - special characters need handling
      let digits = '';
      for (const key of testCase.keySequence) {
        if (key === '-') {
          digits += '-';
        } else if (key === ' ') {
          digits += ' ';
        } else {
          digits += key.toString();
        }
      }

      const result = formatScoreString(digits, { matchUpFormat: testCase.matchUpFormat });
      expect(result).toBe(testCase.expectedScoreString);
    });
  });
});
