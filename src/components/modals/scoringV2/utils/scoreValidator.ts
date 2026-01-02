/**
 * Score validation utilities using tournamentEngine
 */
import { matchUpFormatCode, tournamentEngine } from 'tods-competition-factory';
import { validateMatchUpScore, validateSetScore } from './validateMatchUpScore';
import type { ScoreOutcome } from '../types';

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
export function validateScore(
  scoreString: string,
  matchUpFormat?: string,
  matchUpStatus?: string,
): ScoreOutcome {
  if (!scoreString?.trim()) {
    return {
      isValid: false,
      sets: [],
      error: 'Score is required',
    };
  }

  try {
    // Use generateOutcomeFromScoreString which parses and validates
    const result = tournamentEngine.generateOutcomeFromScoreString({
      scoreString: scoreString.trim(),
      matchUpFormat,
    });

    if (result?.error) {
      const errorMsg =
        typeof result.error === 'string' ? result.error : result.error?.message || JSON.stringify(result.error);
      return {
        isValid: false,
        sets: [],
        error: errorMsg,
      };
    }

    const sets = result?.outcome?.score?.sets || [];
    const scoreObject = result?.outcome?.score; // Full score object for renderMatchUp

    // POST-VALIDATION: Remove winningSide from sets that don't pass validation
    // The factory's generateOutcomeFromScoreString doesn't validate against matchUpFormat
    // so it assigns winningSide to invalid sets like "5-0"
    // We need to strip winningSide from sets that fail our validation
    let anySetInvalidated = false;
    const validatedSets = sets.map((set: any) => {
      const isDecidingSet = false; // We'll determine this properly later
      const validation = validateSetScore(set, matchUpFormat, isDecidingSet, false);
      
      if (!validation.isValid) {
        anySetInvalidated = true;
        // Clone the set but remove winningSide
        const { winningSide, ...setWithoutWinner } = set;
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

    // Parse matchUpFormat for completeness check
    const bestOfMatch = matchUpFormat?.match(/SET(\d+)/)?.[1];
    const bestOfSets = bestOfMatch ? parseInt(bestOfMatch) : 3;
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
      matchUpStatus: 'COMPLETED',
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
  sets: Array<{ side1?: number; side2?: number; side1TiebreakScore?: number; side2TiebreakScore?: number }>,
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
  const incompleteSets = sets.filter((set) => set.side1 === undefined || set.side2 === undefined);
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
  
  // Parse matchUpFormat to check if this is a tiebreak-only format (like SET1-S:TB10)
  let isTiebreakOnlyFormat = false;
  if (matchUpFormat) {
    try {
      const parsed = matchUpFormatCode.parse(matchUpFormat);
      const tiebreakSetTo = parsed?.setFormat?.tiebreakSet?.tiebreakTo;
      const regularSetTo = parsed?.setFormat?.setTo;
      isTiebreakOnlyFormat = !!tiebreakSetTo && !regularSetTo;
    } catch (e) {
      // Ignore parse errors
    }
  }
  
  // Validate each set using our validateSetScore function
  // This provides TB10/TB7/etc validation that the factory may not have yet
  const validatedSets: any[] = [];
  let anyInvalid = false;
  
  for (let i = 0; i < sets.length; i++) {
    const setData = {
      side1Score: sets[i].side1,
      side2Score: sets[i].side2,
      side1TiebreakScore: sets[i].side1TiebreakScore,
      side2TiebreakScore: sets[i].side2TiebreakScore,
    };
    
    const setValidation = validateSetScore(setData, matchUpFormat, false, allowIncomplete);
    
    if (!setValidation.isValid) {
      anyInvalid = true;
      // Don't return early - collect all sets but mark as invalid
      validatedSets.push({ ...setData, winningSide: undefined });
    } else {
      // Set is valid - determine winningSide
      const side1 = sets[i].side1 || 0;
      const side2 = sets[i].side2 || 0;
      let winningSide: number | undefined;
      if (side1 > side2) winningSide = 1;
      else if (side2 > side1) winningSide = 2;
      
      validatedSets.push({ ...setData, winningSide });
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
  const bestOfMatch = matchUpFormat?.match(/SET(\d+)/)?.[1];
  const bestOfSets = bestOfMatch ? parseInt(bestOfMatch) : 3;
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
  const scoreString = sets.map((set) => {
    let setStr = `${set.side1}-${set.side2}`;
    if (set.side1TiebreakScore !== undefined || set.side2TiebreakScore !== undefined) {
      const tbLoser = Math.min(set.side1TiebreakScore || 0, set.side2TiebreakScore || 0);
      setStr += `(${tbLoser})`;
    }
    if (isTiebreakOnlyFormat) {
      setStr = `[${setStr}]`;
    }
    return setStr;
  }).join(' ');
  
  // Call factory validation to get scoreObject (but use our winningSide determination)
  const factoryValidation = validateScore(scoreString, matchUpFormat);
  
  return {
    isValid: matchWinningSide !== undefined,
    sets: validatedSets,
    scoreObject: factoryValidation.scoreObject,
    winningSide: matchWinningSide,
    matchUpStatus: matchWinningSide ? 'COMPLETED' : undefined,
    matchUpFormat,
    score: scoreString,
  };
}
