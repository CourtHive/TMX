/**
 * Analyze tidyScore test cases to determine which matchUpFormats
 * are compatible with each expected outcome
 */

import { governors, matchUpFormatCode } from 'tods-competition-factory';
import { tidyScoreTestCases, type TidyScoreTestCase } from './extractTidyScoreData';

const { validateMatchUpScore, parseScoreString } = governors.scoreGovernor;

/**
 * Common matchUpFormats to test against
 */
const commonFormats = [
  'SET3-S:6/TB7', // Standard 3-set
  'SET3-S:6/TB7-F:TB10', // 3-set with match tiebreak
  'SET5-S:6/TB7', // 5-set
  'SET5-S:6/TB7-F:TB7', // 5-set with final set tiebreak
  'SET1-S:6/TB7', // 1-set
  'SET1-S:8/TB7', // College pro set
  'SET1-S:9/TB7', // Extended pro set
  'SET1-S:4/TB7', // Short set
  'SET3-S:4/TB5', // Fast4 format
  'SET1-S:T20', // Timed set
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
    const parsedFormat = matchUpFormatCode.parse(format);
    
    try {
      // Parse the score string into sets array
      const sets = parseScoreString({
        scoreString: expectedScore,
        matchUpFormat: parsedFormat,
      });

      if (!sets || !Array.isArray(sets)) continue;

      // Check if number of sets is compatible with bestOf
      const bestOf = parsedFormat.bestOf || 1;
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
        const setFormat = isDecidingSet && parsedFormat.finalSetFormat 
          ? parsedFormat.finalSetFormat 
          : parsedFormat.setFormat;
        
        // Check if this is a tiebreak-only set (match tiebreak in bracket notation)
        const isTiebreakOnlySet = set.side1TiebreakScore !== undefined && 
                                  set.side1Score === undefined &&
                                  set.side2TiebreakScore !== undefined &&
                                  set.side2Score === undefined;
        
        if (isTiebreakOnlySet) {
          // For tiebreak-only sets, we can't validate against setTo
          // This is typically a match tiebreak [10-8]
          continue;
        }
        
        // For regular sets, check if scores are compatible with setTo
        if (setFormat?.setTo) {
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
          
          // If winner has exactly setTo, loser must be < setTo - 1 (normal win)
          // OR loser is exactly setTo (went to tiebreak)
          // OR winner is setTo + 1 and loser is setTo - 1 (deuce set)
          if (maxScore === setFormat.setTo) {
            if (minScore === setFormat.setTo) {
              // Went to tiebreak, should have tiebreak scores
              if (!set.side1TiebreakScore && !set.side2TiebreakScore) {
                setsCompatible = false;
                break;
              }
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
          format,
          parsed: parsedFormat,
          validation,
        });
      }
    } catch (error) {
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
      const aNum = parseInt(a);
      const bNum = parseInt(b);
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
