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
 * Calculate the maximum allowed score for a regular set game score
 * based on the opponent's score and set rules
 */
export function getMaxAllowedScore(
  setIndex: number,
  side: 1 | 2,
  currentScores: { side1: number; side2: number },
  config: MatchConfig,
): number {
  const setFormat = getSetFormatForIndex(setIndex, config);
  const setTo = setFormat?.setTo || 6;
  const tiebreakAt = setFormat?.tiebreakAt || setTo;

  const oppScore = side === 1 ? currentScores.side2 : currentScores.side1;

  // If opponent hasn't entered score yet, allow up to setTo + 2
  if (oppScore === 0) {
    return setTo + 2;
  }

  // Calculate max based on tennis scoring rules
  if (oppScore < setTo - 1) {
    // Opponent far from setTo: max is setTo
    return setTo;
  } else if (oppScore === setTo - 1) {
    // Opponent at setTo-1: max is setTo+1 (can win setTo-(setTo-1))
    return setTo + 1;
  } else if (oppScore === setTo) {
    // Opponent at setTo: max is setTo+2 (can win setTo+2 to setTo with 2-game margin)
    return setTo + 2;
  } else if (oppScore >= tiebreakAt) {
    // At or past tiebreak threshold: max is oppScore + 2 (win by 2 margin)
    return oppScore + 2;
  } else {
    // Between setTo and tiebreakAt: max is setTo + 2
    return setTo + 2;
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

  // 2. Score at tiebreak threshold (e.g., 7-6 for TB@6) with tiebreak score entered
  if (maxScore === tiebreakAt + 1 && minScore === tiebreakAt && scores.tiebreak !== undefined) {
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
  const tiebreakAt = setFormat?.tiebreakAt || setTo;

  // No complement for digits >= setTo (score is tied or winning)
  if (digit >= setTo) {
    return null;
  }

  // Special case: digit at tiebreakAt-1 when tiebreakAt < setTo
  // e.g., S:6/TB7@3: 2 → complement is 4 (tiebreakAt + 1)
  if (digit === tiebreakAt - 1 && tiebreakAt < setTo) {
    return tiebreakAt + 1;
  }

  // Normal cases
  if (digit < setTo - 1) {
    // Below setTo-1: complement is setTo
    return setTo;
  } else {
    // digit === setTo - 1: complement is setTo + 1
    return setTo + 1;
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

  // Tiebreak-only sets don't have separate tiebreak input
  if (isSetTiebreakOnly(setFormat)) {
    return false;
  }

  const tiebreakAt = setFormat?.tiebreakAt || setFormat?.setTo || 6;
  const maxScore = Math.max(scores.side1, scores.side2);
  const minScore = Math.min(scores.side1, scores.side2);

  // Show tiebreak when scores are at tiebreakAt+1 vs tiebreakAt
  // e.g., 7-6 or 6-7 for TB@6, 9-8 or 8-9 for TB@8
  return maxScore === tiebreakAt + 1 && minScore === tiebreakAt;
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
