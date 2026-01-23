/**
 * Pure logic functions for Dynamic Sets score entry
 * These functions are extracted from dynamicSetsApproach.ts to be independently testable
 * No DOM dependencies, no side effects - pure business logic only
 */

import type { SetScore } from '../types';

/**
 * Set format information returned by matchUpFormatCode.parse()
 */
export type SetFormat = {
  setTo?: number;
  tiebreakAt?: number;
  tiebreakFormat?: {
    tiebreakTo?: number;
    noAd?: boolean;
  };
  tiebreakSet?: {
    tiebreakTo?: number;
    noAd?: boolean;
  };
  timed?: boolean;
  minutes?: number;
};

/**
 * Configuration for a match
 */
export type MatchConfig = {
  bestOf: number;
  setFormat?: SetFormat;
  finalSetFormat?: SetFormat;
};

/**
 * Result of smart complement calculation
 */
export type SmartComplementResult = {
  field1Value: number;
  field2Value: number;
  shouldApply: boolean;
  reason?: string; // Why complement was not applied
};

/**
 * Get the format for a specific set index
 * Uses finalSetFormat for deciding set if available
 */
export function getSetFormatForIndex(
  setIndex: number,
  config: MatchConfig,
): SetFormat | undefined {
  const isDecidingSet = config.bestOf === 1 || setIndex + 1 === config.bestOf;

  // Use finalSetFormat for deciding set if it exists
  if (isDecidingSet && config.finalSetFormat) {
    return config.finalSetFormat;
  }

  return config.setFormat;
}

/**
 * Check if a set is tiebreak-only (e.g., TB10)
 */
export function isSetTiebreakOnly(format?: SetFormat): boolean {
  return format?.tiebreakSet?.tiebreakTo !== undefined;
}

/**
 * Check if a set format is timed (e.g., T10, T20)
 */
export function isSetTimed(format?: SetFormat): boolean {
  return format?.timed === true && format?.minutes !== undefined;
}

/**
 * Calculate the maximum allowed score for a regular set game score
 * based on the opponent's score and set rules
 * 
 * For timed sets, returns Infinity (no maximum) since scores don't need relationships
 */
export function getMaxAllowedScore(
  setIndex: number,
  side: 1 | 2,
  currentScores: { side1: number; side2: number },
  config: MatchConfig,
): number {
  const setFormat = getSetFormatForIndex(setIndex, config);
  
  // IMPORTANT: For timed sets, there is no maximum score
  // Scores don't need any relationship to each other
  if (isSetTimed(setFormat)) {
    return Infinity;
  }
  
  const setTo = setFormat?.setTo || 6;
  const tiebreakAt = setFormat?.tiebreakAt || setTo;

  const oppScore = side === 1 ? currentScores.side2 : currentScores.side1;

  // Determine absolute max based on tiebreakAt position
  // - If tiebreakAt === setTo (or not specified): max is setTo + 1 (e.g., S:6 allows 7-6)
  // - If tiebreakAt < setTo: max is setTo (e.g., S:6@5 allows 6-5 max, S:5@4 allows 5-4 max)
  const absoluteMax = tiebreakAt === setTo ? setTo + 1 : setTo;
  
  // If opponent hasn't entered score yet, allow up to absoluteMax
  if (oppScore === 0) {
    return absoluteMax;
  }

  // Standard tennis scoring rules
  if (oppScore < tiebreakAt - 1) {
    // Opponent well below tiebreak threshold: max is setTo (win before tiebreak)
    return setTo;
  } else if (oppScore === tiebreakAt - 1) {
    // Opponent at tiebreakAt - 1: special case
    // - If tiebreakAt === setTo (standard format like S:6@6): can go to setTo + 1 to win by 2 (e.g., 7-5)
    // - If tiebreakAt < setTo (format like S:5@4): max is setTo (e.g., 5-3 wins, no need for 6)
    return tiebreakAt === setTo ? setTo + 1 : setTo;
  } else if (oppScore === tiebreakAt) {
    // Opponent at tiebreakAt: could go to tiebreak or win at setTo
    // Max is absoluteMax (setTo+1 if tiebreakAt===setTo, otherwise setTo)
    return absoluteMax;
  } else if (oppScore > tiebreakAt && oppScore < setTo) {
    // Opponent between tiebreakAt and setTo: max is setTo
    return setTo;
  } else if (oppScore === setTo) {
    // Opponent at setTo: depends on format
    if (tiebreakAt === setTo) {
      // Standard format (S:6@6): deuce territory, max is setTo + 2
      return setTo + 2;
    } else {
      // Format like S:5@4: opponent won after tiebreak, my max is tiebreakAt
      return tiebreakAt;
    }
  } else if (oppScore > setTo) {
    // Opponent above setTo: match is in extended play (only when tiebreakAt === setTo)
    // Max is oppScore + 2 (win by 2 margin)
    return oppScore + 2;
  } else {
    // Fallback
    return absoluteMax;
  }
}

/**
 * Determine if a set is complete based on its scores
 */
export function isSetComplete(
  setIndex: number,
  scores: {
    side1: number;
    side2: number;
    tiebreak?: number;
  },
  config: MatchConfig,
): boolean {
  const setFormat = getSetFormatForIndex(setIndex, config);

  // For timed sets, a set is complete when both sides have values
  // Scores don't need any relationship - any values are valid
  if (isSetTimed(setFormat)) {
    return scores.side1 !== undefined && scores.side1 !== null && 
           scores.side2 !== undefined && scores.side2 !== null;
  }

  // Check if this is a tiebreak-only set
  if (isSetTiebreakOnly(setFormat)) {
    // For tiebreak-only sets, we need a winner (validation determines if score is valid)
    // Both sides must have scores and one must be higher
    return scores.side1 > 0 && scores.side2 > 0 && scores.side1 !== scores.side2;
  }

  // Regular set: check tennis scoring rules
  const setTo = setFormat?.setTo || 6;
  const tiebreakAt = setFormat?.tiebreakAt || setTo;
  const maxScore = Math.max(scores.side1, scores.side2);
  const minScore = Math.min(scores.side1, scores.side2);
  const scoreDiff = Math.abs(scores.side1 - scores.side2);

  // Complete if:
  // 1. Winner reached setTo with 2+ game margin
  if (maxScore >= setTo && scoreDiff >= 2) {
    return true;
  }

  // 2. Score indicates tiebreak was played, with tiebreak score entered
  // - If tiebreakAt === setTo: tiebreak at (setTo+1) vs setTo (e.g., 7-6 for S:6@6)
  // - If tiebreakAt < setTo: tiebreak at setTo vs tiebreakAt (e.g., 5-4 for S:5@4)
  const tiebreakScorePattern = tiebreakAt === setTo
    ? maxScore === tiebreakAt + 1 && minScore === tiebreakAt
    : maxScore === setTo && minScore === tiebreakAt;
  
  if (tiebreakScorePattern && scores.tiebreak !== undefined) {
    return true;
  }

  return false;
}

/**
 * Calculate which side won a set
 * Returns undefined if set is not complete
 */
export function getSetWinner(
  setIndex: number,
  scores: {
    side1: number;
    side2: number;
    tiebreak?: number;
  },
  config: MatchConfig,
): 1 | 2 | undefined {
  if (!isSetComplete(setIndex, scores, config)) {
    return undefined;
  }

  if (scores.side1 > scores.side2) return 1;
  if (scores.side2 > scores.side1) return 2;
  return undefined;
}

/**
 * Determine if match is complete based on sets won
 */
export function isMatchComplete(sets: SetScore[], bestOf: number): boolean {
  const setsNeeded = Math.ceil(bestOf / 2);
  const setsWon1 = sets.filter((s) => s.winningSide === 1).length;
  const setsWon2 = sets.filter((s) => s.winningSide === 2).length;

  return setsWon1 >= setsNeeded || setsWon2 >= setsNeeded;
}

/**
 * Get the match winner based on sets won
 * Returns undefined if match is not complete
 */
export function getMatchWinner(sets: SetScore[], bestOf: number): 1 | 2 | undefined {
  if (!isMatchComplete(sets, bestOf)) {
    return undefined;
  }

  const setsNeeded = Math.ceil(bestOf / 2);
  const setsWon1 = sets.filter((s) => s.winningSide === 1).length;
  const setsWon2 = sets.filter((s) => s.winningSide === 2).length;

  if (setsWon1 >= setsNeeded) return 1;
  if (setsWon2 >= setsNeeded) return 2;
  return undefined;
}

/**
 * Calculate the complement score for smart complement entry
 * Returns null if no predictable complement exists
 * 
 * @param digit - The digit entered (0-9)
 * @param setFormat - The format for this set
 * @returns Complement value or null if digit >= setTo (no predictable complement)
 */
export function calculateComplement(digit: number, setFormat?: SetFormat): number | null {
  const setTo = setFormat?.setTo || 6;

  // No complement for digits >= setTo (score is tied or winning)
  if (digit >= setTo) {
    return null;
  }

  // Smart complements work for all standard formats:
  // - S:6/TB7@6 (tiebreakAt === setTo): entering 2 → complement is 6
  // - S:6/TB7@5 (tiebreakAt === setTo-1): entering 2 → complement is 6
  // - S:5/TB9@4 (tiebreakAt === setTo-1): entering 2 → complement is 5
  // NOTE: tiebreakAt can ONLY be setTo or setTo-1 (never less)
  
  const tiebreakAt = setFormat?.tiebreakAt || setTo;

  // When digit < setTo - 1: complement is setTo (winning before tiebreak)
  if (digit < setTo - 1) {
    return setTo;
  }
  
  // When digit === setTo - 1: depends on format
  // - If tiebreakAt === setTo: complement is setTo + 1 (e.g., 5 → 7 for S:6@6)
  // - If tiebreakAt < setTo: complement is setTo (e.g., 4 → 5 for S:5@4)
  if (tiebreakAt === setTo) {
    return setTo + 1;
  } else {
    return setTo;
  }
}

/**
 * Determine if smart complement should be applied for a given input
 * 
 * @param digit - The digit being entered
 * @param isShiftPressed - Whether Shift key is pressed
 * @param setIndex - Index of the current set
 * @param sets - Current sets array
 * @param config - Match configuration
 * @param smartComplementsUsed - Set of indices where complement was already used
 * @param smartComplementsEnabled - Whether feature is enabled in settings
 * @returns Result indicating if/how complement should be applied
 */
export function shouldApplySmartComplement(
  digit: number,
  isShiftPressed: boolean,
  setIndex: number,
  sets: SetScore[],
  config: MatchConfig,
  smartComplementsUsed: Set<number>,
  smartComplementsEnabled: boolean,
): SmartComplementResult {
  // Feature disabled
  if (!smartComplementsEnabled) {
    return {
      field1Value: digit,
      field2Value: 0,
      shouldApply: false,
      reason: 'Feature disabled in settings',
    };
  }

  // Already used for this set
  if (smartComplementsUsed.has(setIndex)) {
    return {
      field1Value: digit,
      field2Value: 0,
      shouldApply: false,
      reason: 'Already used for this set',
    };
  }

  // Check if match is already complete
  if (isMatchComplete(sets, config.bestOf)) {
    return {
      field1Value: digit,
      field2Value: 0,
      shouldApply: false,
      reason: 'Match already complete',
    };
  }

  // Check if this is a tiebreak-only set (no smart complement for TB10)
  const setFormat = getSetFormatForIndex(setIndex, config);
  if (isSetTiebreakOnly(setFormat)) {
    return {
      field1Value: digit,
      field2Value: 0,
      shouldApply: false,
      reason: 'Tiebreak-only set',
    };
  }

  // Calculate complement
  const complement = calculateComplement(digit, setFormat);
  if (complement === null) {
    return {
      field1Value: digit,
      field2Value: 0,
      shouldApply: false,
      reason: 'No predictable complement for this digit',
    };
  }

  // Apply complement based on Shift key
  if (isShiftPressed) {
    // Shift+digit: complement in field1, digit in field2
    return {
      field1Value: complement,
      field2Value: digit,
      shouldApply: true,
    };
  } else {
    // Just digit: digit in field1, complement in field2
    return {
      field1Value: digit,
      field2Value: complement,
      shouldApply: true,
    };
  }
}

/**
 * Determine if tiebreak input should be visible for a set
 */
export function shouldShowTiebreak(
  setIndex: number,
  scores: { side1: number; side2: number },
  config: MatchConfig,
): boolean {
  const setFormat = getSetFormatForIndex(setIndex, config);

  // Timed sets never have tiebreaks
  if (isSetTimed(setFormat)) {
    return false;
  }

  // Tiebreak-only sets don't have separate tiebreak input
  if (isSetTiebreakOnly(setFormat)) {
    return false;
  }

  const setTo = setFormat?.setTo || 6;
  const tiebreakAt = setFormat?.tiebreakAt || setTo;
  const maxScore = Math.max(scores.side1, scores.side2);
  const minScore = Math.min(scores.side1, scores.side2);

  // Show tiebreak based on format:
  // - If tiebreakAt === setTo: show at (setTo+1) vs setTo (e.g., 7-6 for S:6@6)
  // - If tiebreakAt < setTo: show at setTo vs tiebreakAt (e.g., 5-4 for S:5@4)
  if (tiebreakAt === setTo) {
    // Standard format: tiebreak at 7-6, 8-7, etc.
    return maxScore === tiebreakAt + 1 && minScore === tiebreakAt;
  } else {
    // Format like S:5@4: tiebreak at 5-4 or 4-5
    return maxScore === setTo && minScore === tiebreakAt;
  }
}

/**
 * Determine if a new set row should be created
 */
export function shouldCreateNextSet(
  currentSetIndex: number,
  sets: SetScore[],
  config: MatchConfig,
): boolean {
  // Don't exceed bestOf
  if (currentSetIndex + 1 >= config.bestOf) {
    return false;
  }

  // Don't create if match is complete
  if (isMatchComplete(sets, config.bestOf)) {
    return false;
  }

  // Create if current set is complete
  const currentSet = sets[currentSetIndex];
  if (!currentSet) {
    return false;
  }

  return currentSet.winningSide !== undefined;
}

/**
 * Build a SetScore object from input values
 * Assigns winningSide if set is complete
 */
export function buildSetScore(
  setIndex: number,
  side1Value: string,
  side2Value: string,
  tiebreakValue: string | undefined,
  config: MatchConfig,
): SetScore {
  const side1Score = Number.parseInt(side1Value) || 0;
  const side2Score = Number.parseInt(side2Value) || 0;
  const tiebreakScore = tiebreakValue ? Number.parseInt(tiebreakValue) : undefined;

  const setFormat = getSetFormatForIndex(setIndex, config);

  // Check if tiebreak-only set
  if (isSetTiebreakOnly(setFormat)) {
    // Main inputs are tiebreak scores
    const winningSide =
      side1Score > 0 && side2Score > 0 && side1Score !== side2Score
        ? side1Score > side2Score
          ? 1
          : 2
        : undefined;

    return {
      side1Score: 0,
      side2Score: 0,
      side1TiebreakScore: side1Score,
      side2TiebreakScore: side2Score,
      winningSide,
    };
  }

  // Regular set
  const scores = { side1: side1Score, side2: side2Score, tiebreak: tiebreakScore };
  const winningSide = getSetWinner(setIndex, scores, config);

  const setData: SetScore = {
    side1Score,
    side2Score,
    winningSide,
  };

  // Add tiebreak scores if present
  if (tiebreakScore !== undefined) {
    const tiebreakTo = setFormat?.tiebreakFormat?.tiebreakTo || 7;
    const isNoAd = setFormat?.tiebreakFormat?.noAd;

    // Calculate winner score based on tiebreak rules
    let winnerScore: number;
    if (tiebreakScore < tiebreakTo - 1) {
      winnerScore = tiebreakTo;
    } else {
      winnerScore = isNoAd ? tiebreakScore + 1 : tiebreakScore + 2;
    }

    if (side1Score > side2Score) {
      setData.side1TiebreakScore = winnerScore;
      setData.side2TiebreakScore = tiebreakScore;
    } else {
      setData.side1TiebreakScore = tiebreakScore;
      setData.side2TiebreakScore = winnerScore;
    }
  }

  return setData;
}
