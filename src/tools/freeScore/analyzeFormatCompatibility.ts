/**
 * Analyze tidyScore test cases to determine which matchUpFormats
 * are compatible with each expected outcome
 */

import { governors, matchUpFormatCode } from 'tods-competition-factory';
import { tidyScoreTestCases, type TidyScoreTestCase } from './extractTidyScoreData';
import { MATCH_FORMATS } from '../../constants/matchUpFormats';

const { validateMatchUpScore, parseScoreString } = governors.scoreGovernor;

/**
 * All matchUpFormats to test against (pre-parsed for efficiency)
 */
const commonFormats = [
  // Best of 3 sets
  { key: 'SET3_S6_TB7', code: MATCH_FORMATS.SET3_S6_TB7, parsed: matchUpFormatCode.parse(MATCH_FORMATS.SET3_S6_TB7) },
  {
    key: 'SET3_S6_TB7_F_TB10',
    code: MATCH_FORMATS.SET3_S6_TB7_F_TB10,
    parsed: matchUpFormatCode.parse(MATCH_FORMATS.SET3_S6_TB7_F_TB10),
  },
  { key: 'SET3_S6_TB10', code: MATCH_FORMATS.SET3_S6_TB10, parsed: matchUpFormatCode.parse(MATCH_FORMATS.SET3_S6_TB10) },
  
  // Best of 5 sets
  { key: 'SET5_S6_TB7', code: MATCH_FORMATS.SET5_S6_TB7, parsed: matchUpFormatCode.parse(MATCH_FORMATS.SET5_S6_TB7) },
  {
    key: 'SET5_S6_TB7_F_TB10',
    code: MATCH_FORMATS.SET5_S6_TB7_F_TB10,
    parsed: matchUpFormatCode.parse(MATCH_FORMATS.SET5_S6_TB7_F_TB10),
  },
  
  // Single set formats
  { key: 'SET1_S6_TB7', code: MATCH_FORMATS.SET1_S6_TB7, parsed: matchUpFormatCode.parse(MATCH_FORMATS.SET1_S6_TB7) },
  { key: 'SET1_S6_TB10', code: MATCH_FORMATS.SET1_S6_TB10, parsed: matchUpFormatCode.parse(MATCH_FORMATS.SET1_S6_TB10) },
  { key: 'SET1_S8_TB7', code: MATCH_FORMATS.SET1_S8_TB7, parsed: matchUpFormatCode.parse(MATCH_FORMATS.SET1_S8_TB7) },
  { key: 'SET1_S4_TB7', code: MATCH_FORMATS.SET1_S4_TB7, parsed: matchUpFormatCode.parse(MATCH_FORMATS.SET1_S4_TB7) },
  
  // Tiebreak-only formats
  { key: 'SET1_S_TB7', code: MATCH_FORMATS.SET1_S_TB7, parsed: matchUpFormatCode.parse(MATCH_FORMATS.SET1_S_TB7) },
  { key: 'SET1_S_TB10', code: MATCH_FORMATS.SET1_S_TB10, parsed: matchUpFormatCode.parse(MATCH_FORMATS.SET1_S_TB10) },
  { key: 'SET1_S_TB21', code: MATCH_FORMATS.SET1_S_TB21, parsed: matchUpFormatCode.parse(MATCH_FORMATS.SET1_S_TB21) },
  
  // Pro sets
  { key: 'SET1_S8', code: MATCH_FORMATS.SET1_S8, parsed: matchUpFormatCode.parse(MATCH_FORMATS.SET1_S8) },
  { key: 'SET1_S10', code: MATCH_FORMATS.SET1_S10, parsed: matchUpFormatCode.parse(MATCH_FORMATS.SET1_S10) },
  
  // Fast4 format
  { key: 'FAST4', code: MATCH_FORMATS.FAST4, parsed: matchUpFormatCode.parse(MATCH_FORMATS.FAST4) },
];

export interface FormatAnalysis {
  input: string;
  expectedScore?: string;
  expectedMatchUpStatus?: string;
  compatibleFormats: {
    format: string;
    parsed: any;
    validation: any;
  }[];
}

/**
 * Analyze a single test case to determine format compatibility
 */
export function analyzeTestCase(testCase: TidyScoreTestCase): FormatAnalysis {
  const { input, expectedScore, expectedMatchUpStatus } = testCase;
  const compatibleFormats: FormatAnalysis['compatibleFormats'] = [];

  if (!expectedScore) {
    return { input, expectedScore, expectedMatchUpStatus, compatibleFormats };
  }

  for (const format of commonFormats) {
    const { code, parsed: parsedFormat } = format;

    try {
      // Parse the score string into sets array
      const sets = parseScoreString({
        scoreString: expectedScore,
        matchUpFormat: parsedFormat,
      });

      if (!sets || !Array.isArray(sets)) continue;

      // Check if score has a match tiebreak (final set with only tiebreak scores)
      const lastSet = sets[sets.length - 1];
      const hasMatchTiebreak =
        lastSet?.side1TiebreakScore !== undefined &&
        lastSet?.side1Score === undefined &&
        lastSet?.side2TiebreakScore !== undefined &&
        lastSet?.side2Score === undefined;

      // Check if number of sets is compatible with bestOf
      const bestOf = parsedFormat.bestOf || 1;
      const isDecidingSet = sets.length === bestOf;

      // If score has a match tiebreak, format must have a finalSetFormat with tiebreak
      if (hasMatchTiebreak) {
        const hasFinalSetTiebreak =
          parsedFormat.finalSetFormat?.tiebreakSet?.tiebreakTo ||
          parsedFormat.finalSetFormat?.tiebreakFormat?.tiebreakTo;
        if (!hasFinalSetTiebreak) {
          continue; // Score requires match tiebreak but format doesn't have one
        }
      }

      // If format requires match tiebreak for deciding set, score must have one
      // Assume COMPLETED unless explicitly stated otherwise
      const isCompleted = !expectedMatchUpStatus || expectedMatchUpStatus === 'COMPLETED';
      if (isCompleted && isDecidingSet && !hasMatchTiebreak) {
        const finalSetIsTiebreakOnly =
          parsedFormat.finalSetFormat?.tiebreakSet?.tiebreakTo && !parsedFormat.finalSetFormat?.setTo;
        if (finalSetIsTiebreakOnly) {
          continue; // Format requires match tiebreak but score has regular set
        }
      }
      const minSetsRequired = Math.ceil(bestOf / 2); // e.g., bestOf 3 needs at least 2 sets
      const maxSetsAllowed = bestOf; // e.g., bestOf 3 can have at most 3 sets

      if (sets.length < minSetsRequired || sets.length > maxSetsAllowed) {
        continue; // Incompatible number of sets
      }

      // Check if set scores are compatible with format
      let setsCompatible = true;
      for (let i = 0; i < sets.length; i++) {
        const set = sets[i];
        const isDecidingSet = i === sets.length - 1 && sets.length === bestOf;
        const setFormat =
          isDecidingSet && parsedFormat.finalSetFormat ? parsedFormat.finalSetFormat : parsedFormat.setFormat;

        // Check if this is a tiebreak-only set (match tiebreak in bracket notation)
        const isTiebreakOnlySet =
          set.side1TiebreakScore !== undefined &&
          set.side1Score === undefined &&
          set.side2TiebreakScore !== undefined &&
          set.side2Score === undefined;

        if (isTiebreakOnlySet) {
          // For tiebreak-only sets, we can't validate against setTo
          // This is typically a match tiebreak [10-8]
          continue;
        }

        // Check if format is tiebreak-only (e.g., SET1-S:TB10)
        const isTiebreakOnlyFormat = setFormat?.tiebreakSet?.tiebreakTo && !setFormat?.setTo;
        
        if (isTiebreakOnlyFormat) {
          // Tiebreak-only formats should not have regular game scores
          // If set has game scores (not in bracket notation), it's not tiebreak-only
          const hasGameScores = set.side1Score !== undefined || set.side2Score !== undefined;
          if (hasGameScores) {
            // Set has game scores but format is tiebreak-only
            setsCompatible = false;
            break;
          }
          
          // For tiebreak-only formats, the set must have scores reaching tiebreakTo
          // For completed matches, at least one side must have reached tiebreakTo
          const side1 = set.side1TiebreakScore || 0;
          const side2 = set.side2TiebreakScore || 0;
          const maxScore = Math.max(side1, side2);
          const minScore = Math.min(side1, side2);
          const tiebreakTo = setFormat.tiebreakSet.tiebreakTo;
          const isNoAd = setFormat.tiebreakSet.NoAD;
          
          if (isCompleted && maxScore < tiebreakTo) {
            // Score doesn't reach tiebreak-only format requirement
            setsCompatible = false;
            break;
          }
          
          // Check NoAD constraint for tiebreak-only sets
          if (isNoAd) {
            // NoAD: first to tiebreakTo wins (winBy = 1)
            // Valid: [10-9], [10-8]; Invalid: [11-10], [12-10]
            if (maxScore > tiebreakTo) {
              // Score exceeds tiebreakTo (only valid without NoAD for win-by-2)
              setsCompatible = false;
              break;
            }
          } else {
            // Standard: win-by-2 required
            // Valid: [10-8], [11-9], [12-10]
            if (maxScore >= tiebreakTo && maxScore - minScore < 2) {
              // Doesn't meet win-by-2 requirement
              setsCompatible = false;
              break;
            }
          }
        } else if (setFormat?.setTo) {
          // For regular sets, check if scores are compatible with setTo
          const side1 = set.side1Score || 0;
          const side2 = set.side2Score || 0;
          const maxScore = Math.max(side1, side2);
          const minScore = Math.min(side1, side2);

          // Maximum possible score is setTo + 1 (e.g., 7-5 in a set to 6)
          // unless it went to tiebreak (scores tied at setTo)
          const maxAllowed = setFormat.setTo + 1;

          if (maxScore > maxAllowed) {
            // Score exceeds format limits
            setsCompatible = false;
            break;
          }

          // Deuce rule: If winner score is > setTo, loser must be >= setTo-1
          // Example: 9-7 is valid for setTo:8, but 9-6 is not
          // Note: NoAD doesn't affect set-level scoring, only game-level (deuce/advantage)
          if (maxScore > setFormat.setTo && minScore < setFormat.setTo - 1) {
            // Score violates deuce rule
            setsCompatible = false;
            break;
          }

          // If scores are tied at setTo, must have tiebreak scores
          if (
            maxScore === setFormat.setTo &&
            minScore === setFormat.setTo &&
            !set.side1TiebreakScore &&
            !set.side2TiebreakScore
          ) {
            setsCompatible = false;
            break;
          }

          // If set has tiebreak scores, games must have been tied at tiebreakAt
          // For example: 7-6(10) means tied at 6-6 (tiebreakAt must be 6)
          if (set.side1TiebreakScore !== undefined || set.side2TiebreakScore !== undefined) {
            const tiebreakAt = setFormat.tiebreakAt || setFormat.setTo;
            // The score before tiebreak should be tiebreakAt-tiebreakAt
            // After tiebreak, winner gets one more game: (tiebreakAt+1)-tiebreakAt
            if (maxScore !== tiebreakAt + 1 || minScore !== tiebreakAt) {
              // Tiebreak occurred at wrong score for this format
              setsCompatible = false;
              break;
            }
          }
        }
      }

      if (!setsCompatible) {
        continue;
      }

      // Validate the parsed score (wrap sets in score object)
      const validation = validateMatchUpScore({
        score: { sets },
        matchUpFormat: parsedFormat,
        matchUpStatus: expectedMatchUpStatus,
      });

      if (validation.isValid) {
        compatibleFormats.push({
          format: code,
          parsed: parsedFormat,
          validation,
        });
      }
    } catch {
      // Format incompatible, skip
    }
  }

  return {
    input,
    expectedScore,
    expectedMatchUpStatus,
    compatibleFormats,
  };
}

/**
 * Analyze all test cases and group by patterns
 */
export function analyzeAllTestCases() {
  const results: FormatAnalysis[] = [];
  const patternGroups: {
    [key: string]: FormatAnalysis[];
  } = {};

  for (const testCase of tidyScoreTestCases) {
    const analysis = analyzeTestCase(testCase);
    results.push(analysis);

    // Group by number of compatible formats
    const formatCount = analysis.compatibleFormats.length;
    const key = `${formatCount} formats`;
    if (!patternGroups[key]) patternGroups[key] = [];
    patternGroups[key].push(analysis);
  }

  return { results, patternGroups };
}

/**
 * Run the analysis and log results
 */
export function runAnalysis() {
  console.log('Analyzing tidyScore test cases for format compatibility...\n');

  const { results, patternGroups } = analyzeAllTestCases();

  // Summary statistics
  console.log('=== SUMMARY ===');
  console.log(`Total test cases: ${results.length}`);
  console.log(`\nFormat compatibility distribution:`);

  Object.keys(patternGroups)
    .sort((a, b) => {
      const aNum = Number.parseInt(a);
      const bNum = Number.parseInt(b);
      return bNum - aNum;
    })
    .forEach((key) => {
      console.log(`  ${key}: ${patternGroups[key].length} cases`);
    });

  // Example cases by format count
  console.log('\n=== EXAMPLES BY COMPATIBILITY ===');

  // Cases with single format match (most specific)
  const singleFormat = patternGroups['1 formats']?.slice(0, 5);
  if (singleFormat?.length) {
    console.log('\nCases matching exactly ONE format:');
    singleFormat.forEach(({ input, expectedScore, compatibleFormats }) => {
      console.log(`  Input: "${input}"`);
      console.log(`  Expected: "${expectedScore}"`);
      console.log(`  Format: ${compatibleFormats[0]?.format}`);
    });
  }

  // Cases with many format matches (most ambiguous)
  const manyFormats = patternGroups[`${commonFormats.length} formats`]?.slice(0, 5);
  if (manyFormats?.length) {
    console.log(`\nCases matching ALL ${commonFormats.length} formats (ambiguous):`);
    manyFormats.forEach(({ input, expectedScore }) => {
      console.log(`  Input: "${input}" => "${expectedScore}"`);
    });
  }

  // Cases with no format matches (problematic)
  const noFormats = patternGroups['0 formats'];
  if (noFormats?.length) {
    console.log(`\n⚠️  Cases matching NO formats (${noFormats.length}):`);
    noFormats.slice(0, 10).forEach(({ input, expectedScore }) => {
      console.log(`  Input: "${input}" => "${expectedScore}"`);
    });
  }

  return results;
}

// Export for use in tests or other modules
export { tidyScoreTestCases };
