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
 * Validate a score string using generateOutcomeFromScoreString
 */
export function validateScore(scoreString: string, matchUpFormat?: string, matchUpStatus?: string): ScoreOutcome {
  if (!scoreString?.trim()) {
    return {
      isValid: false,
      sets: [],
      error: 'Score is required',
    };
  }

  try {
    // CRITICAL: The factory's generateOutcomeFromScoreString normalizes scores to show winner first
    // For TMX, we want to preserve the exact order user entered (e.g., "3-6" should be side1=3, side2=6)
    // So we parse the score directly using parseScoreString instead
    const parsedResult = tournamentEngine.parseScoreString({
      scoreString: scoreString.trim(),
      matchUpFormat,
    });

    if (!parsedResult || parsedResult.length === 0) {
      return {
        isValid: false,
        sets: [],
        error: 'Invalid score format',
      };
    }

    const sets = parsedResult;

    // Build scoreObject manually for renderMatchUp
    // Generate score strings for each side
    const scoreStringSide1 = sets
      .map((set: any) => {
        let str = `${set.side1Score || 0}-${set.side2Score || 0}`;
        if (set.side1TiebreakScore !== undefined) {
          str += `(${set.winningSide === 1 ? set.side1TiebreakScore : set.side2TiebreakScore})`;
        }
        return str;
      })
      .join(' ');

    const scoreStringSide2 = sets
      .map((set: any) => {
        let str = `${set.side2Score || 0}-${set.side1Score || 0}`;
        if (set.side2TiebreakScore !== undefined) {
          str += `(${set.winningSide === 2 ? set.side2TiebreakScore : set.side1TiebreakScore})`;
        }
        return str;
      })
      .join(' ');

    const scoreObject = {
      sets,
      scoreStringSide1,
      scoreStringSide2,
    };

    // POST-VALIDATION: Remove winningSide from sets that don't pass validation
    // The factory's generateOutcomeFromScoreString doesn't validate against matchUpFormat
    // so it assigns winningSide to invalid sets like "5-0"
    // We need to strip winningSide from sets that fail our validation

    // Determine bestOf to check for deciding set
    const bestOfMatch = matchUpFormat?.match(/SET(\d+)/)?.[1];
    const bestOfSets = bestOfMatch ? Number.parseInt(bestOfMatch) : 3;

    // VALIDATE SET TYPES: Check that bracket notation matches format expectations
    // Split score string into individual sets, preserving tiebreak notation
    const setStrings = scoreString.trim().match(/\S+/g) || [];
    const parsed = matchUpFormatCode.parse(matchUpFormat);
    const finalSetIsTiebreakOnly = parsed?.finalSetFormat?.tiebreakSet?.tiebreakTo && !parsed?.finalSetFormat?.setTo;
    const allSetsAreTiebreakOnly = parsed?.setFormat?.tiebreakSet?.tiebreakTo && !parsed?.setFormat?.setTo;

    for (let i = 0; i < setStrings.length; i++) {
      const setString = setStrings[i];
      const setNumber = i + 1;
      const isDecidingSet = setNumber === bestOfSets;
      const hasBrackets = setString.startsWith('[') && setString.endsWith(']');

      // Check if this set should be tiebreak-only based on format
      const shouldBeTiebreakOnly = allSetsAreTiebreakOnly || (isDecidingSet && finalSetIsTiebreakOnly);
      const shouldBeRegular = !shouldBeTiebreakOnly;

      // Validate bracket notation matches format
      if (shouldBeRegular && hasBrackets) {
        return {
          isValid: false,
          sets,
          scoreObject,
          error: `Set ${setNumber}: Format expects regular set (e.g., 6-4), but got tiebreak-only set ${setString}`,
        };
      }

      if (shouldBeTiebreakOnly && !hasBrackets) {
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

    // CRITICAL: If we removed winningSide from any set, the match cannot have a winningSide
    // (unless there's an irregular ending, which is handled separately by the caller)
    let winningSide: number | undefined;
    let isComplete = false;

    if (anySetInvalidated) {
      // If any set was invalidated, match is incomplete - no winningSide
      winningSide = undefined;
      isComplete = false;
    } else {
      // All sets are valid - calculate winningSide from factory result
      const setsWon = { side1: 0, side2: 0 };
      validatedSets.forEach((set: any) => {
        if (set.winningSide === 1) setsWon.side1++;
        else if (set.winningSide === 2) setsWon.side2++;
      });

      if (setsWon.side1 >= setsToWin) {
        winningSide = 1;
      } else if (setsWon.side2 >= setsToWin) {
        winningSide = 2;
      }

      // Check if match is complete (someone won majority of sets)
      isComplete = setsWon.side1 >= setsToWin || setsWon.side2 >= setsToWin;
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
 * Validate individual set scores (for Dynamic Sets approach in Phase 3)
 * Currently unused - will be needed when implementing set-by-set input
 */
export function validateSetScores(
  sets: Array<{ side1?: number; side2?: number; side1TiebreakScore?: number; side2TiebreakScore?: number; winningSide?: number }>,
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

  // Check if all sets have both scores
  // For tiebreak-only sets, scores can be in side1TiebreakScore/side2TiebreakScore instead
  const incompleteSets = sets.filter((set) => {
    const hasRegularScores = set.side1 !== undefined && set.side2 !== undefined;
    const hasTiebreakScores = set.side1TiebreakScore !== undefined && set.side2TiebreakScore !== undefined;
    return !hasRegularScores && !hasTiebreakScores;
  });
  if (incompleteSets.length > 0 && !allowIncomplete) {
    return {
      isValid: false,
      sets: [],
      error: 'All sets must have scores for both sides',
    };
  }

  // CRITICAL: Only include sets where both sides have values (not incomplete sets)
  // Filter out incomplete sets (where either side is undefined or 0 with no entry)
  // We need to check the original values, not the parsed numbers
  // But we don't have access to the original strings here...
  // The issue is that "5-0" gets passed here but 5-0 where 0 means "no entry" is incomplete
  // We should not include sets in the validation if they don't have winningSide

  // Actually, the caller should handle this - don't pass incomplete sets to validation

  // Note: We check per-set whether it's tiebreak-only when building score string

  // Validate each set using our validateSetScore function
  // This provides TB10/TB7/etc validation that the factory may not have yet
  const validatedSets: any[] = [];
  let anyInvalid = false;

  // Determine bestOf to check for deciding set
  const bestOfMatch = matchUpFormat?.match(/SET(\d+)/)?.[1];
  const bestOfSets = bestOfMatch ? Number.parseInt(bestOfMatch) : 3;

  for (let i = 0; i < sets.length; i++) {
    const setData = {
      side1Score: sets[i].side1,
      side2Score: sets[i].side2,
      side1TiebreakScore: sets[i].side1TiebreakScore,
      side2TiebreakScore: sets[i].side2TiebreakScore,
    };

    // Check if this is the deciding set (last possible set in the match)
    const isDecidingSet = i + 1 === bestOfSets;

    // Allow incomplete per-set: if set has no winningSide, it's incomplete
    // Otherwise use the global allowIncomplete flag
    const setHasWinner = sets[i].winningSide !== undefined;
    const allowIncompleteForSet = allowIncomplete || !setHasWinner;

    const setValidation = validateSetScore(setData, matchUpFormat, isDecidingSet, allowIncompleteForSet);

    if (setValidation.isValid) {
      // Set is valid - determine winningSide
      let winningSide: number | undefined = sets[i].winningSide;
      
      // If set didn't have winningSide, check if it would pass strict validation
      // If so, assign winningSide (it's a truly complete set, not just allowed incomplete)
      if (winningSide === undefined) {
        // Test with strict validation (no allowIncomplete)
        const strictValidation = validateSetScore(setData, matchUpFormat, isDecidingSet, false);
        
        if (strictValidation.isValid) {
          // Set passes strict validation - assign winningSide
          const hasTiebreakScores = sets[i].side1TiebreakScore !== undefined && sets[i].side2TiebreakScore !== undefined;
          const side1 = hasTiebreakScores ? sets[i].side1TiebreakScore || 0 : sets[i].side1 || 0;
          const side2 = hasTiebreakScores ? sets[i].side2TiebreakScore || 0 : sets[i].side2 || 0;
          if (side1 > side2) winningSide = 1;
          else if (side2 > side1) winningSide = 2;
        }
        // Otherwise winningSide stays undefined (incomplete set)
      }

      validatedSets.push({ ...setData, winningSide });
    } else {
      anyInvalid = true;
      // Don't return early - collect all sets but mark as invalid
      validatedSets.push({ ...setData, winningSide: undefined });
    }
  }

  // If any set is invalid, return invalid result
  if (anyInvalid && !allowIncomplete) {
    return {
      isValid: false,
      sets: validatedSets,
      error: 'One or more sets have invalid scores',
    };
  }

  // Calculate match winningSide based on sets won
  const setsToWin = Math.ceil(bestOfSets / 2);

  const setsWon = { side1: 0, side2: 0 };
  validatedSets.forEach((set) => {
    if (set.winningSide === 1) setsWon.side1++;
    else if (set.winningSide === 2) setsWon.side2++;
  });

  let matchWinningSide: number | undefined;
  if (setsWon.side1 >= setsToWin) matchWinningSide = 1;
  else if (setsWon.side2 >= setsToWin) matchWinningSide = 2;

  // Build score string for factory (still useful for scoreObject)
  const scoreString = sets
    .map((set) => {
      // Check if THIS specific set is tiebreak-only (no regular scores, only tiebreak scores)
      const setHasRegularScores = set.side1 !== undefined && set.side2 !== undefined;
      const setHasTiebreakScores = set.side1TiebreakScore !== undefined && set.side2TiebreakScore !== undefined;
      const setIsTiebreakOnly = !setHasRegularScores && setHasTiebreakScores;

      if (setIsTiebreakOnly) {
        // Tiebreak-only set: format as [9-11]
        return `[${set.side1TiebreakScore}-${set.side2TiebreakScore}]`;
      } else {
        // Regular set: format as 6-3 or 7-6(5)
        let setStr = `${set.side1}-${set.side2}`;
        if (setHasTiebreakScores) {
          const tbLoser = Math.min(set.side1TiebreakScore || 0, set.side2TiebreakScore || 0);
          setStr += `(${tbLoser})`;
        }
        return setStr;
      }
    })
    .join(' ');

  // Call factory validation to get scoreObject (but use our winningSide determination)
  const factoryValidation = validateScore(scoreString, matchUpFormat);

  return {
    isValid: matchWinningSide !== undefined,
    sets: validatedSets,
    scoreObject: factoryValidation.scoreObject,
    winningSide: matchWinningSide,
    matchUpStatus: matchWinningSide ? COMPLETED : undefined,
    matchUpFormat,
    score: scoreString,
  };
}
