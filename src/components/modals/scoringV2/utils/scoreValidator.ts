/**
 * Score validation utilities using tournamentEngine
 */
import { tournamentEngine } from 'tods-competition-factory';
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
  if (!scoreString || !scoreString.trim()) {
    return { error: 'Score is required' };
  }

  try {
    // NOTE: The parameter is 'score', not 'scoreString'
    const result = tournamentEngine.tidyScore({ score: scoreString.trim() });

    // Handle error case
    if (result?.error) {
      const errorMsg =
        typeof result.error === 'string' ? result.error : result.error?.message || JSON.stringify(result.error);
      return { error: errorMsg };
    }

    // Return tidyScore and matchUpStatus from result
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
export function validateScore(scoreString: string, matchUpFormat?: string): ScoreOutcome {
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

    // Calculate winningSide from sets
    const setsWon = { side1: 0, side2: 0 };
    sets.forEach((set: any) => {
      if (set.winningSide === 1) setsWon.side1++;
      else if (set.winningSide === 2) setsWon.side2++;
    });

    let winningSide: number | undefined;
    if (setsWon.side1 > setsWon.side2) {
      winningSide = 1;
    } else if (setsWon.side2 > setsWon.side1) {
      winningSide = 2;
    }

    // Check if match is complete (someone won majority of sets)
    const bestOf = matchUpFormat?.match(/SET(\d+)/)?.[1];
    const setsToWin = bestOf ? Math.ceil(parseInt(bestOf) / 2) : 2;
    const isComplete = setsWon.side1 >= setsToWin || setsWon.side2 >= setsToWin;

    if (!isComplete) {
      return {
        isValid: false,
        sets,
        scoreObject, // Include full score object
        error: `Incomplete match - need ${setsToWin} sets to win`,
      };
    }

    return {
      isValid: true,
      sets,
      scoreObject, // Include full score object
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
 * Validate individual set scores
 */
export function validateSetScores(
  sets: Array<{ side1?: number; side2?: number }>,
  matchUpFormat?: string,
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
  if (incompleteSets.length > 0) {
    return {
      isValid: false,
      sets: [],
      error: 'All sets must have scores for both sides',
    };
  }

  // Convert to score string format: "6-3 3-6 6-4"
  const scoreString = sets.map((set) => `${set.side1}-${set.side2}`).join(' ');

  return validateScore(scoreString, matchUpFormat);
}
