/**
 * freeScore Parser
 * 
 * Parses free-form score input using matchUpFormat context for intelligent interpretation.
 * Character-by-character state machine that handles ambiguous digit sequences.
 * 
 * Goals:
 * - Accept any reasonable score notation (spaces, dashes, brackets optional)
 * - Use matchUpFormat to disambiguate (e.g., "123" → "12-3" vs "1-23" based on setTo)
 * - Provide confidence scores and suggestions for ambiguous inputs
 * - Give helpful error messages with position context
 * - Support incomplete scores (user typing in real-time)
 */

import { matchUpFormatCode } from 'tods-competition-factory';
import type { ParsedFormat } from 'tods-competition-factory';

// ============================================================================
// Types
// ============================================================================

export interface ParsedSet {
  side1Score?: number;
  side2Score?: number;
  side1TiebreakScore?: number;
  side2TiebreakScore?: number;
  winningSide?: number;
  setNumber: number;
}

export interface ParserState {
  // Input tracking
  input: string;
  position: number;
  
  // Score building
  setIndex: number;
  currentSide1Buffer: string;
  currentSide2Buffer: string;
  currentTiebreakSide1Buffer: string;
  currentTiebreakSide2Buffer: string;
  sets: ParsedSet[];
  
  // Format context
  parsedFormat: ParsedFormat;
  
  // State machine
  state: TokenizerState;
  inTiebreak: boolean;
  expectingTiebreakOnly: boolean; // For match tiebreak formats
  
  // Validation
  isValid: boolean;
  errors: ParseError[];
  warnings: string[];
  
  // Ambiguity tracking
  confidence: number; // 0.0 to 1.0
  ambiguities: string[];
  suggestions: string[];
}

export enum TokenizerState {
  START = 'START',
  PARSING_SIDE1 = 'PARSING_SIDE1',
  PARSING_SIDE2 = 'PARSING_SIDE2',
  PARSING_TIEBREAK_SIDE1 = 'PARSING_TIEBREAK_SIDE1',
  PARSING_TIEBREAK_SIDE2 = 'PARSING_TIEBREAK_SIDE2',
  SET_COMPLETE = 'SET_COMPLETE',
  MATCH_COMPLETE = 'MATCH_COMPLETE',
  ERROR = 'ERROR',
}

export interface ParseError {
  position: number;
  message: string;
  expected?: string;
  got?: string;
  context?: string;
}

export interface ParseResult {
  valid: boolean;
  formattedScore: string;
  sets: ParsedSet[];
  confidence: number;
  errors: ParseError[];
  warnings: string[];
  ambiguities: string[];
  suggestions: string[];
  incomplete: boolean;
  matchComplete: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the set format for a specific set index
 * Uses finalSetFormat for the deciding set if it exists
 */
function getSetFormat(parsedFormat: ParsedFormat, setIndex: number): any {
  const bestOf = parsedFormat.bestOf || 3;
  const isDecidingSet = setIndex === bestOf - 1; // Last possible set
  
  if (isDecidingSet && parsedFormat.finalSetFormat) {
    return parsedFormat.finalSetFormat;
  }
  
  return parsedFormat.setFormat;
}

/**
 * Check if current set format is tiebreak-only (match tiebreak)
 */
function isTiebreakOnlySet(setFormat: any): boolean {
  return !!setFormat?.tiebreakSet?.tiebreakTo && !setFormat?.setTo;
}

/**
 * Get maximum valid score for a game in current set
 */
function getMaxGameScore(setFormat: any): number {
  if (isTiebreakOnlySet(setFormat)) {
    return 0; // No game scores for tiebreak-only sets
  }
  
  const setTo = setFormat?.setTo || 6;
  return setTo + 1; // e.g., 7 for setTo:6 (can reach 7-5)
}

/**
 * Get tiebreak limit for current set
 */
function getTiebreakLimit(setFormat: any): number {
  const tiebreakSet = setFormat?.tiebreakSet;
  const tiebreakFormat = setFormat?.tiebreakFormat;
  
  if (tiebreakSet) {
    return tiebreakSet.tiebreakTo || 10;
  }
  
  if (tiebreakFormat) {
    return tiebreakFormat.tiebreakTo || 7;
  }
  
  return 7; // Default
}

/**
 * Check if character is a digit
 */
function isDigit(char: string): boolean {
  return /^\d$/.test(char);
}

/**
 * Check if character is a separator (anything non-digit, non-tiebreak-indicator)
 * This allows flexible input: spaces, dashes, commas, slashes, etc.
 */
function isSeparator(char: string): boolean {
  // Not a digit, not a tiebreak indicator, not a closer
  return !isDigit(char) && !isTiebreakIndicator(char) && !isTiebreakCloser(char);
}

/**
 * Check if character indicates tiebreak (open paren or bracket)
 */
function isTiebreakIndicator(char: string): boolean {
  return char === '(' || char === '[';
}

/**
 * Check if character closes tiebreak
 */
function isTiebreakCloser(char: string): boolean {
  return char === ')' || char === ']';
}



/**
 * Check if score triggers tiebreak (games tied at tiebreakAt)
 */
function shouldEnterTiebreak(side1: number, side2: number, setFormat: any): boolean {
  const tiebreakAt = setFormat?.tiebreakAt || setFormat?.setTo || 6;
  return side1 === tiebreakAt && side2 === tiebreakAt;
}

/**
 * Check if set is complete
 */
function isSetComplete(side1: number, side2: number, setFormat: any): boolean {
  const setTo = setFormat?.setTo || 6;
  const maxScore = Math.max(side1, side2);
  const minScore = Math.min(side1, side2);
  
  // Must reach setTo
  if (maxScore < setTo) {
    return false;
  }
  
  // Win by 2
  if (maxScore - minScore >= 2) {
    return true;
  }
  
  // Can't exceed setTo + 1
  if (maxScore > setTo + 1) {
    return false;
  }
  
  return false;
}

/**
 * Check if tiebreak is complete
 */
function isTiebreakComplete(
  side1: number,
  side2: number,
  setFormat: any
): boolean {
  const tiebreakTo = getTiebreakLimit(setFormat);
  const maxScore = Math.max(side1, side2);
  const minScore = Math.min(side1, side2);
  
  // Check for NoAD in tiebreak-only sets
  const isNoAd = setFormat?.tiebreakSet?.NoAD || setFormat?.tiebreakFormat?.NoAD;
  
  if (isNoAd) {
    // First to tiebreakTo wins (no win-by-2)
    return maxScore >= tiebreakTo;
  }
  
  // Standard: must reach tiebreakTo and win by 2
  if (maxScore < tiebreakTo) {
    return false;
  }
  
  return maxScore - minScore >= 2;
}

// ============================================================================
// Main Parser Function
// ============================================================================

/**
 * Parse free-form score string using matchUpFormat context
 */
export function parseScore(
  input: string,
  matchUpFormat: string | ParsedFormat
): ParseResult {
  // Parse format if string provided
  const parsedFormat = typeof matchUpFormat === 'string' 
    ? matchUpFormatCode.parse(matchUpFormat)
    : matchUpFormat;
  
  if (!parsedFormat) {
    return {
      valid: false,
      formattedScore: '',
      sets: [],
      confidence: 0,
      errors: [{
        position: 0,
        message: 'Invalid matchUpFormat',
      }],
      warnings: [],
      ambiguities: [],
      suggestions: [],
      incomplete: false,
      matchComplete: false,
    };
  }
  
  // Initialize state
  const state: ParserState = {
    input,
    position: 0,
    setIndex: 0,
    currentSide1Buffer: '',
    currentSide2Buffer: '',
    currentTiebreakSide1Buffer: '',
    currentTiebreakSide2Buffer: '',
    sets: [],
    parsedFormat,
    state: TokenizerState.START,
    inTiebreak: false,
    expectingTiebreakOnly: false,
    isValid: true,
    errors: [],
    warnings: [],
    confidence: 1.0,
    ambiguities: [],
    suggestions: [],
  };
  
  // Check if first set is tiebreak-only
  const firstSetFormat = getSetFormat(parsedFormat, 0);
  if (isTiebreakOnlySet(firstSetFormat)) {
    state.expectingTiebreakOnly = true;
    state.inTiebreak = true;
    state.state = TokenizerState.PARSING_TIEBREAK_SIDE1;
  } else {
    state.state = TokenizerState.PARSING_SIDE1;
  }
  
  // Process character by character
  while (state.position < input.length && state.isValid) {
    processCharacter(state);
  }
  
  // Finalize any incomplete set
  finalizeCurrentScore(state);
  
  // Check if match is complete
  const matchComplete = checkMatchComplete(state);
  
  // Format output
  const formattedScore = formatScore(state);
  
  return {
    valid: state.isValid && state.errors.length === 0,
    formattedScore,
    sets: state.sets,
    confidence: state.confidence,
    errors: state.errors,
    warnings: state.warnings,
    ambiguities: state.ambiguities,
    suggestions: state.suggestions,
    incomplete: !matchComplete && state.sets.length > 0,
    matchComplete,
  };
}

/**
 * Process a single character from input
 */
function processCharacter(state: ParserState): void {
  const char = state.input[state.position];
  
  // Skip whitespace and separators in certain contexts
  if (isSeparator(char)) {
    handleSeparator(state);
    return;
  }
  
  // Handle tiebreak indicators
  if (isTiebreakIndicator(char)) {
    handleTiebreakStart(state);
    return;
  }
  
  if (isTiebreakCloser(char)) {
    handleTiebreakEnd(state);
    return;
  }
  
  // Handle digits
  if (isDigit(char)) {
    handleDigit(state, char);
    return;
  }
  
  // Unknown character
  state.errors.push({
    position: state.position,
    message: `Unexpected character '${char}'`,
    got: char,
    context: getContext(state),
  });
  state.isValid = false;
}

/**
 * Handle separator characters
 */
function handleSeparator(state: ParserState): void {
  // Separators can indicate:
  // 1. Between side1 and side2 (e.g., "6-4")
  // 2. Between sets (e.g., "6-4 6-3")
  // 3. Tiebreak indicator (e.g., "6-7(5)")
  
  if (state.state === TokenizerState.PARSING_SIDE1 && state.currentSide1Buffer) {
    // Transition to side2
    state.state = TokenizerState.PARSING_SIDE2;
    state.position++;
    return;
  }
  
  if (state.state === TokenizerState.PARSING_SIDE2 && state.currentSide2Buffer) {
    // Check if set is complete or needs tiebreak
    finalizeSet(state);
    state.position++;
    return;
  }
  
  if (state.state === TokenizerState.PARSING_TIEBREAK_SIDE1 && state.currentTiebreakSide1Buffer) {
    // Transition to tiebreak side2
    state.state = TokenizerState.PARSING_TIEBREAK_SIDE2;
    state.position++;
    return;
  }
  
  // Just skip separator
  state.position++;
}

/**
 * Handle start of tiebreak notation
 */
function handleTiebreakStart(state: ParserState): void {
  // Check context: are we expecting a tiebreak?
  const currentSetFormat = getSetFormat(state.parsedFormat, state.setIndex);
  const isTiebreakOnly = isTiebreakOnlySet(currentSetFormat);
  
  if (isTiebreakOnly) {
    // Tiebreak-only set: bracket notation expected
    state.inTiebreak = true;
    state.state = TokenizerState.PARSING_TIEBREAK_SIDE1;
    state.position++;
    return;
  }
  
  // Regular set tiebreak
  if (state.currentSide1Buffer && state.currentSide2Buffer) {
    const side1 = Number.parseInt(state.currentSide1Buffer);
    const side2 = Number.parseInt(state.currentSide2Buffer);
    
    if (shouldEnterTiebreak(side1, side2, currentSetFormat)) {
      state.inTiebreak = true;
      state.state = TokenizerState.PARSING_TIEBREAK_SIDE1;
      state.position++;
      return;
    }
  }
  
  // Ambiguous: could be tiebreak notation
  state.warnings.push(`Tiebreak indicator at position ${state.position} may be ambiguous`);
  state.inTiebreak = true;
  state.state = TokenizerState.PARSING_TIEBREAK_SIDE1;
  state.position++;
}

/**
 * Handle end of tiebreak notation
 */
function handleTiebreakEnd(state: ParserState): void {
  if (state.inTiebreak) {
    // Finalize tiebreak and set
    finalizeTiebreak(state);
    state.inTiebreak = false;
    state.position++;
    return;
  }
  
  // Unexpected closer
  state.warnings.push(`Unexpected tiebreak closer at position ${state.position}`);
  state.position++;
}

/**
 * Handle digit characters
 */
function handleDigit(state: ParserState, char: string): void {
  const currentSetFormat = getSetFormat(state.parsedFormat, state.setIndex);
  
  if (state.inTiebreak) {
    handleTiebreakDigit(state, char, currentSetFormat);
  } else {
    handleGameDigit(state, char, currentSetFormat);
  }
}

/**
 * Handle digit in game score context
 */
function handleGameDigit(state: ParserState, char: string, setFormat: any): void {
  const maxGameScore = getMaxGameScore(setFormat);
  
  if (state.state === TokenizerState.PARSING_SIDE1 || state.state === TokenizerState.START) {
    state.state = TokenizerState.PARSING_SIDE1;
    state.currentSide1Buffer += char;
    
    const currentValue = Number.parseInt(state.currentSide1Buffer);
    
    // Check if we should auto-transition to side2
    const nextPos = state.position + 1;
    
    if (nextPos < state.input.length && isDigit(state.input[nextPos])) {
      // Lookahead: would adding next digit exceed max?
      const nextDigit = state.input[nextPos];
      const twoDigitValue = Number.parseInt(state.currentSide1Buffer + nextDigit);
      
      if (twoDigitValue > maxGameScore) {
        // Current buffer is complete, next digit starts side2
        state.warnings.push(
          `Potential score issue: "${state.currentSide1Buffer}${nextDigit}" would exceed max game score ${maxGameScore}`
        );
        state.state = TokenizerState.PARSING_SIDE2;
      }
      // Otherwise keep buffering (might be valid 2-digit like "10")
    } else {
      // No more digits ahead, or next char is separator
      // Current buffer is complete, transition to side2
      state.state = TokenizerState.PARSING_SIDE2;
    }
    
    // Warn if exceeds max
    if (currentValue > maxGameScore) {
      state.warnings.push(
        `Score ${currentValue} exceeds max ${maxGameScore} at position ${state.position}`
      );
    }
    
    state.position++;
    return;
  }
  
  if (state.state === TokenizerState.PARSING_SIDE2) {
    state.currentSide2Buffer += char;
    
    // Check if we should auto-finalize the set
    const nextPos = state.position + 1;
    
    if (nextPos < state.input.length && isDigit(state.input[nextPos])) {
      // Lookahead: would adding next digit exceed max?
      const nextDigit = state.input[nextPos];
      const twoDigitValue = Number.parseInt(state.currentSide2Buffer + nextDigit);
      
      if (twoDigitValue > maxGameScore) {
        // Current buffer completes side2
        // Check if this makes a valid set
        const side1 = Number.parseInt(state.currentSide1Buffer);
        const side2 = Number.parseInt(state.currentSide2Buffer);
        
        // Valid set or hit digit limit - finalize and continue
        // Validation will catch issues if set is invalid
        const isValid = isSetComplete(side1, side2, setFormat) || shouldEnterTiebreak(side1, side2, setFormat);
        if (!isValid) {
          state.warnings.push(`Set ${state.setIndex + 1} may be incomplete: ${side1}-${side2}`);
        }
        finalizeSet(state);
      }
      // Otherwise keep buffering (might be valid 2-digit like "10")
    } else if (nextPos >= state.input.length) {
      // End of input - finalize set will be handled by finalizeCurrentScore
    }
    
    state.position++;
    return;
  }
  
  // Shouldn't reach here
  state.position++;
}

/**
 * Handle digit in tiebreak score context
 */
function handleTiebreakDigit(state: ParserState, char: string, setFormat: any): void {
  const tiebreakLimit = getTiebreakLimit(setFormat);
  
  if (state.state === TokenizerState.PARSING_TIEBREAK_SIDE1) {
    state.currentTiebreakSide1Buffer += char;
    
    // Check if we should auto-transition to side2
    const currentValue = Number.parseInt(state.currentTiebreakSide1Buffer);
    const nextPos = state.position + 1;
    
    if (nextPos < state.input.length && isDigit(state.input[nextPos])) {
      const nextDigit = state.input[nextPos];
      const twoDigitValue = Number.parseInt(state.currentTiebreakSide1Buffer + nextDigit);
      
      // Strategy: decide if current buffer is complete or should continue
      // For TB10: "1" + "0" = "10" (valid side1), "10" + "6" = "106" (too big, so "10" is complete)
      
      if (currentValue < tiebreakLimit && twoDigitValue <= tiebreakLimit + 10) {
        // Current value hasn't reached minimum and two-digit is still reasonable
        // Keep buffering - don't transition
        // This handles "1" + "0" = "10" for TB10
      } else {
        // Either current >= tiebreakLimit, or two-digit exceeds reasonable limit
        // Transition to side2
        state.state = TokenizerState.PARSING_TIEBREAK_SIDE2;
      }
    } else {
      // No more digits or separator next - current buffer completes side1
      state.state = TokenizerState.PARSING_TIEBREAK_SIDE2;
    }
    
    state.position++;
    return;
  }
  
  if (state.state === TokenizerState.PARSING_TIEBREAK_SIDE2) {
    state.currentTiebreakSide2Buffer += char;
    
    const nextPos = state.position + 1;
    
    // Check if we should auto-finalize the tiebreak
    if (nextPos < state.input.length && isDigit(state.input[nextPos])) {
      const nextDigit = state.input[nextPos];
      const twoDigitValue = Number.parseInt(state.currentTiebreakSide2Buffer + nextDigit);
      
      if (twoDigitValue > tiebreakLimit + 10) {
        // Current buffer completes side2, check if tiebreak is complete
        const side1 = Number.parseInt(state.currentTiebreakSide1Buffer);
        const side2 = Number.parseInt(state.currentTiebreakSide2Buffer);
        
        // Finalize tiebreak (complete or hit limit)
        const isComplete = isTiebreakComplete(side1, side2, setFormat);
        if (!isComplete) {
          state.warnings.push(`Tiebreak may be incomplete: ${side1}-${side2}`);
        }
        finalizeSet(state);
      }
    } else {
      // End of input or separator - will be handled by finalizeCurrentScore or separator handler
    }
    
    state.position++;
    return;
  }
  
  state.position++;
}

/**
 * Finalize current set and move to next
 */
function finalizeSet(state: ParserState): void {
  const currentSetFormat = getSetFormat(state.parsedFormat, state.setIndex);
  const isTiebreakOnly = isTiebreakOnlySet(currentSetFormat);
  
  // For tiebreak-only sets, we only have tiebreak scores
  if (isTiebreakOnly) {
    if (!state.currentTiebreakSide1Buffer || !state.currentTiebreakSide2Buffer) {
      return; // Incomplete tiebreak
    }
    
    const tb1 = Number.parseInt(state.currentTiebreakSide1Buffer);
    const tb2 = Number.parseInt(state.currentTiebreakSide2Buffer);
    
    const set: ParsedSet = {
      side1Score: 0, // No game scores for tiebreak-only
      side2Score: 0,
      side1TiebreakScore: tb1,
      side2TiebreakScore: tb2,
      setNumber: state.setIndex + 1,
      winningSide: tb1 > tb2 ? 1 : 2,
    };
    
    state.sets.push(set);
  } else {
    // Regular set with optional tiebreak
    if (!state.currentSide1Buffer || !state.currentSide2Buffer) {
      return; // Incomplete set
    }
    
    const side1Score = Number.parseInt(state.currentSide1Buffer);
    const side2Score = Number.parseInt(state.currentSide2Buffer);
    
    const set: ParsedSet = {
      side1Score,
      side2Score,
      setNumber: state.setIndex + 1,
    };
    
    // Add tiebreak scores if present
    // Handle case where only one tiebreak score is provided (the losing score)
    if (state.currentTiebreakSide1Buffer || state.currentTiebreakSide2Buffer) {
      const tb1Str = state.currentTiebreakSide1Buffer;
      const tb2Str = state.currentTiebreakSide2Buffer;
      
      if (tb1Str && tb2Str) {
        // Both scores provided
        set.side1TiebreakScore = Number.parseInt(tb1Str);
        set.side2TiebreakScore = Number.parseInt(tb2Str);
      } else if (tb1Str || tb2Str) {
        // Only one score provided - this is the LOSING tiebreak score
        const losingScore = Number.parseInt(tb1Str || tb2Str);
        const tiebreakLimit = getTiebreakLimit(currentSetFormat);
        const isNoAd = currentSetFormat?.tiebreakFormat?.NoAD;
        
        // Infer winning score (must be at least tiebreakTo and win by 2, unless NoAD)
        const minWinningScore = isNoAd ? tiebreakLimit : Math.max(tiebreakLimit, losingScore + 2);
        
        // Determine which side won based on game scores
        if (side1Score > side2Score) {
          // Side 1 won, so tb2Str is losing score
          set.side1TiebreakScore = minWinningScore;
          set.side2TiebreakScore = losingScore;
        } else {
          // Side 2 won, so tb1Str is losing score
          set.side1TiebreakScore = losingScore;
          set.side2TiebreakScore = minWinningScore;
        }
      }
    }
    
    // Determine winner from game scores
    if (side1Score > side2Score) {
      set.winningSide = 1;
    } else if (side2Score > side1Score) {
      set.winningSide = 2;
    }
    
    state.sets.push(set);
  }
  
  // Reset for next set
  state.currentSide1Buffer = '';
  state.currentSide2Buffer = '';
  state.currentTiebreakSide1Buffer = '';
  state.currentTiebreakSide2Buffer = '';
  state.setIndex++;
  state.state = TokenizerState.PARSING_SIDE1;
  
  // Check if next set is tiebreak-only
  const nextSetFormat = getSetFormat(state.parsedFormat, state.setIndex);
  if (isTiebreakOnlySet(nextSetFormat)) {
    state.expectingTiebreakOnly = true;
    state.inTiebreak = true;
    state.state = TokenizerState.PARSING_TIEBREAK_SIDE1;
  }
}

/**
 * Finalize tiebreak within current set
 */
function finalizeTiebreak(state: ParserState): void {
  // Tiebreak scores are added when finalizing the set
  // Just transition back to set completion
  finalizeSet(state);
}

/**
 * Finalize any incomplete score at end of input
 */
function finalizeCurrentScore(state: ParserState): void {
  if (state.currentSide1Buffer || state.currentSide2Buffer || 
      state.currentTiebreakSide1Buffer || state.currentTiebreakSide2Buffer) {
    finalizeSet(state);
  }
}

/**
 * Check if match is complete
 */
function checkMatchComplete(state: ParserState): boolean {
  const bestOf = state.parsedFormat.bestOf || 3;
  const setsNeeded = Math.ceil(bestOf / 2);
  
  const side1Wins = state.sets.filter(s => s.winningSide === 1).length;
  const side2Wins = state.sets.filter(s => s.winningSide === 2).length;
  
  return side1Wins >= setsNeeded || side2Wins >= setsNeeded;
}

/**
 * Format the parsed score for output
 */
function formatScore(state: ParserState): string {
  const parts: string[] = [];
  
  for (const set of state.sets) {
    // Check if this is a tiebreak-only set (no game scores, or games are 0-0)
    const isTiebreakOnly = (!set.side1Score || set.side1Score === 0) && 
                          (!set.side2Score || set.side2Score === 0) &&
                          (set.side1TiebreakScore !== undefined || set.side2TiebreakScore !== undefined);
    
    if (isTiebreakOnly) {
      // Match tiebreak: [10-8]
      const tb1 = set.side1TiebreakScore ?? 0;
      const tb2 = set.side2TiebreakScore ?? 0;
      parts.push(`[${tb1}-${tb2}]`);
    } else {
      // Regular set with optional tiebreak
      let setPart = `${set.side1Score || 0}-${set.side2Score || 0}`;
      
      // Add tiebreak notation if present
      if (set.side1TiebreakScore !== undefined || set.side2TiebreakScore !== undefined) {
        const tb1 = set.side1TiebreakScore ?? 0;
        const tb2 = set.side2TiebreakScore ?? 0;
        
        // Regular set tiebreak: show losing score in parentheses
        // Winner is determined by game scores, not tiebreak scores
        const losingTiebreakScore = set.winningSide === 1 ? tb2 : tb1;
        setPart += `(${losingTiebreakScore})`;
      }
      
      parts.push(setPart);
    }
  }
  
  return parts.join(' ');
}

/**
 * Get context string for error messages
 */
function getContext(state: ParserState): string {
  const start = Math.max(0, state.position - 5);
  const end = Math.min(state.input.length, state.position + 5);
  const before = state.input.substring(start, state.position);
  const after = state.input.substring(state.position + 1, end);
  return `...${before}[${state.input[state.position]}]${after}...`;
}
