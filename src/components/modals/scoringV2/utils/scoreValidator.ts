/**
 * Score validation utilities using tournamentEngine
 */
import { tournamentEngine, matchUpFormatCode, matchUpStatusConstants, governors } from 'tods-competition-factory';
import type { ScoreOutcome } from '../types';

const { COMPLETED } = matchUpStatusConstants;
const { validateMatchUpScore, validateSetScore } = governors.scoreGovernor;

export type TidyScoreResult = {
  tidyScore?: string;
  matchUpStatus?: string;
  error?: string;
};

/**
 * Clean up a messy score string using tidyScore
 */
export function tidyScore(scoreString: string): TidyScoreResult {
  if (!scoreString?.trim()) {
    return { error: 'Score is required' };
  }

  try {
    // Factory's tidyScore now recognizes RETIRED, WALKOVER, and DEFAULTED keywords
    // No pre-processing needed - factory handles abbreviations and full keywords
    const processedScore = scoreString.trim();

    // NOTE: The parameter is 'score', not 'scoreString'
    const result = tournamentEngine.tidyScore({ score: processedScore });

    // Handle error case
    if (result?.error) {
      const errorMsg =
        typeof result.error === 'string' ? result.error : result.error?.message || JSON.stringify(result.error);
      return { error: errorMsg };
    }

    // Return tidyScore and matchUpStatus from factory result
    return {
      tidyScore: result?.score,
      matchUpStatus: result?.matchUpStatus,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid format' };
  }
}

/**
 * Validate a score string using generateOutcomeFromScoreString with preserveSideOrder
 */
export function validateScore(scoreString: string, matchUpFormat?: string, matchUpStatus?: string): ScoreOutcome {
  // For irregular endings that remove score (WALKOVER, CANCELLED, DEAD_RUBBER), empty score is valid
  const { WALKOVER, CANCELLED, DEAD_RUBBER } = matchUpStatusConstants;
  const scoresRemovedStatuses = [WALKOVER, CANCELLED, DEAD_RUBBER];

  if (!scoreString?.trim()) {
    if (matchUpStatus && scoresRemovedStatuses.includes(matchUpStatus)) {
      // Valid irregular ending without score
      return {
        isValid: true,
        sets: [],
        matchUpStatus,
        scoreObject: undefined, // No score for these statuses
      };
    }
    return {
      isValid: false,
      sets: [],
      error: 'Score is required',
    };
  }

  try {
    // Use factory's generateOutcomeFromScoreString with preserveSideOrder=true
    // This preserves the exact order user entered (e.g., "3-6" stays as side1=3, side2=6)
    // and correctly calculates winningSide for both aggregate and standard scoring
    const { outcome, error: generateError } = tournamentEngine.generateOutcomeFromScoreString({
      scoreString: scoreString.trim(),
      matchUpFormat,
      preserveSideOrder: true,
    });

    if (generateError || !outcome?.score?.sets) {
      return {
        isValid: false,
        sets: [],
        error: generateError || 'Invalid score format',
      };
    }

    const sets = outcome.score.sets;
    const scoreObject = outcome.score;

    // POST-VALIDATION: Remove winningSide from sets that don't pass validation
    // Validate each set against the matchUpFormat to ensure scores are legal
    // Strip winningSide from sets that fail validation (e.g., "5-0" in SET format)

    // VALIDATE SET TYPES: Check that bracket notation matches format expectations
    // Split score string into individual sets, preserving tiebreak notation
    const setStrings = scoreString
      .trim()
      .split(/\s+/)
      .filter((s) => s.length > 0);
    const parsed = matchUpFormatCode.parse(matchUpFormat);

    // Determine bestOf to check for deciding set
    // For exactly formats (SET3X, SET4X), use the exactly value
    // For bestOf formats (SET3, SET5), use the bestOf value
    const bestOfSets = parsed?.exactly || parsed?.bestOf || 3;
    const finalSetIsTiebreakOnly = parsed?.finalSetFormat?.tiebreakSet?.tiebreakTo && !parsed?.finalSetFormat?.setTo;
    const allSetsAreTiebreakOnly = parsed?.setFormat?.tiebreakSet?.tiebreakTo && !parsed?.setFormat?.setTo;

    // Check if this is a TB1 format (tiebreak to 1)
    const finalSetIsTB1 = parsed?.finalSetFormat?.tiebreakSet?.tiebreakTo === 1;
    const allSetsAreTB1 = parsed?.setFormat?.tiebreakSet?.tiebreakTo === 1;

    for (let i = 0; i < setStrings.length; i++) {
      const setString = setStrings[i];
      const setNumber = i + 1;
      const isDecidingSet = setNumber === bestOfSets;
      const hasBrackets = setString.startsWith('[') && setString.endsWith(']');

      // TB1 scores ("1-0" or "0-1") are allowed without brackets
      // They're unambiguous and this is the natural notation for timed set aggregate scoring
      const isTB1Score =
        (setString === '1-0' || setString === '0-1') && ((isDecidingSet && finalSetIsTB1) || allSetsAreTB1);

      // Check if this set should be tiebreak-only based on format
      const shouldBeTiebreakOnly = allSetsAreTiebreakOnly || (isDecidingSet && finalSetIsTiebreakOnly);
      const shouldBeRegular = !shouldBeTiebreakOnly;

      // Validate bracket notation matches format (with TB1 exception)
      if (shouldBeRegular && hasBrackets) {
        return {
          isValid: false,
          sets,
          scoreObject,
          error: `Set ${setNumber}: Format expects regular set (e.g., 6-4), but got tiebreak-only set ${setString}`,
        };
      }

      if (shouldBeTiebreakOnly && !hasBrackets && !isTB1Score) {
        return {
          isValid: false,
          sets,
          scoreObject,
          error: `Set ${setNumber}: Format expects tiebreak-only set (e.g., [10-8]), but got regular set ${setString}`,
        };
      }
    }

    let anySetInvalidated = false;
    const validatedSets = sets.map((set: any, index: number) => {
      // Check if this is the deciding set (last possible set in the match)
      const isDecidingSet = index + 1 === bestOfSets;
      const validation = validateSetScore(set, matchUpFormat, isDecidingSet, false);

      if (!validation.isValid) {
        anySetInvalidated = true;
        // Clone the set but remove winningSide
        const { ...setWithoutWinner } = set;
        return setWithoutWinner;
      }

      return set;
    });

    // Update scoreObject with validated sets
    const validatedScoreObject = {
      ...scoreObject,
      sets: validatedSets,
    };

    // Validate overall match structure (factory prototype)
    const matchUpScoreValidation = validateMatchUpScore(validatedSets, matchUpFormat, matchUpStatus);
    if (!matchUpScoreValidation.isValid) {
      return {
        isValid: false,
        sets: validatedSets,
        scoreObject: validatedScoreObject,
        error: matchUpScoreValidation.error,
      };
    }

    // Parse matchUpFormat for completeness check (bestOfSets already defined above)
    const setsToWin = Math.ceil(bestOfSets / 2);

    // Use factory's winningSide calculation (already handles aggregate and standard scoring)
    // If any set was invalidated, override to undefined (match is incomplete)
    let winningSide: number | undefined = anySetInvalidated ? undefined : outcome.winningSide;
    
    // Check if match is complete
    let isComplete = false;
    if (!anySetInvalidated && winningSide !== undefined) {
      const isAggregateScoring = parsed?.setFormat?.based === 'A' || parsed?.finalSetFormat?.based === 'A';
      
      if (isAggregateScoring) {
        // For aggregate with exactly format, ALL sets must be complete (both scores)
        // Count only sets with both side1Score and side2Score defined
        const completeSets = validatedSets.filter(s => 
          s.side1Score !== undefined && s.side2Score !== undefined
        ).length;
        
        // Match is complete when all required complete sets are played
        isComplete = completeSets >= bestOfSets;
      } else {
        // For standard scoring, match is complete when someone won majority
        const setsWon = { side1: 0, side2: 0 };
        validatedSets.forEach((set: any) => {
          if (set.winningSide === 1) setsWon.side1++;
          else if (set.winningSide === 2) setsWon.side2++;
        });
        isComplete = setsWon.side1 >= setsToWin || setsWon.side2 >= setsToWin;
      }
    }

    if (!isComplete) {
      return {
        isValid: false,
        sets: validatedSets,
        scoreObject: validatedScoreObject, // Include full score object
        error: `Incomplete match - need ${setsToWin} sets to win`,
      };
    }

    return {
      isValid: true,
      sets: validatedSets,
      scoreObject: validatedScoreObject, // Include full score object
      winningSide,
      matchUpStatus: COMPLETED,
      matchUpFormat,
      score: scoreString.trim(),
    };
  } catch (error) {
    return {
      isValid: false,
      sets: [],
      error: error instanceof Error ? error.message : 'Invalid score format',
    };
  }
}

/**
 * Validate individual set scores (for Dynamic Sets approach)
 * Builds a scoreString from the sets and uses validateScore for consistent validation
 */
export function validateSetScores(
  sets: Array<{
    side1?: number;
    side2?: number;
    side1TiebreakScore?: number;
    side2TiebreakScore?: number;
    winningSide?: number;
  }>,
  matchUpFormat?: string,
  allowIncomplete?: boolean,
): ScoreOutcome {
  if (!sets || sets.length === 0) {
    return {
      isValid: false,
      sets: [],
      error: 'At least one set is required',
    };
  }

  // Build a scoreString from the sets and use validateScore for consistent validation
  // This ensures dynamicSets uses the same factory logic as freeScore
  const scoreString = sets
    .map((set) => {
      const side1 = set.side1 ?? '';
      const side2 = set.side2 ?? '';
      
      // Handle tiebreak-only sets (bracket notation)
      // CRITICAL: Check if this is truly a tiebreak-only set (no game scores or both are 0)
      const isTiebreakOnlySet = (!side1 || side1 === 0) && (!side2 || side2 === 0);
      if (isTiebreakOnlySet && 
          set.side1TiebreakScore !== undefined && 
          set.side2TiebreakScore !== undefined) {
        return `[${set.side1TiebreakScore}-${set.side2TiebreakScore}]`;
      }
      
      // Regular set scores
      if (side1 === '' || side2 === '') {
        return ''; // Incomplete set
      }
      
      // Check if tiebreak scores should be added (set with tiebreak)
      if (set.side1TiebreakScore !== undefined || set.side2TiebreakScore !== undefined) {
        const tb1 = set.side1TiebreakScore ?? 0;
        const tb2 = set.side2TiebreakScore ?? 0;
        // Tennis notation shows the LOSER's tiebreak score
        // Determine which side won the set (by game score)
        const side1WonSet = Number(side1) > Number(side2);
        const loserTiebreakScore = side1WonSet ? tb2 : tb1;
        return `${side1}-${side2}(${loserTiebreakScore})`;
      }
      
      return `${side1}-${side2}`;
    })
    .filter((s) => s !== '') // Remove incomplete sets
    .join(' ');

  if (!scoreString) {
    return {
      isValid: false,
      sets: [],
      error: 'At least one complete set is required',
    };
  }

  // Use validateScore for consistent factory-based validation
  return validateScore(scoreString, matchUpFormat, allowIncomplete ? undefined : COMPLETED);
}
