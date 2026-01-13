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

import { matchUpFormatCode, matchUpStatusConstants } from 'tods-competition-factory';
import type { ParsedFormat } from 'tods-competition-factory';

const { RETIRED, WALKOVER, DEFAULTED, SUSPENDED, CANCELLED, INCOMPLETE, DEAD_RUBBER, IN_PROGRESS, AWAITING_RESULT } =
  matchUpStatusConstants;

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

  // Irregular endings (matchUpStatus)
  irregularEnding?: string;
  irregularEndingPosition?: number;

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
  matchUpStatus?: string; // Uses matchUpStatusConstants from factory
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detect irregular ending patterns in remaining input
 * Returns the matchUpStatus constant and the position where it was detected
 */
function detectIrregularEnding(input: string, startPos: number): { ending?: string; endPos: number } {
  const remaining = input.substring(startPos).trim().toLowerCase();

  // Check for longer/more-specific patterns first to avoid ambiguity

  // IN PROGRESS: 'in', 'inp', 'in prog', 'in progress' (check first to catch "in " patterns)
  const inProgressPattern = /^in(\s+p(rog(ress)?)?)?$/i;
  if (inProgressPattern.exec(remaining)) {
    return { ending: IN_PROGRESS, endPos: input.length };
  }

  // INCOMPLETE: 'inc', 'incomp', 'incomplete' (requires 'inc' minimum to avoid conflict with 'in')
  const incompletePattern = /^inc(omp(lete?)?)?/i;
  if (incompletePattern.exec(remaining)) {
    return { ending: INCOMPLETE, endPos: input.length };
  }

  // DEAD RUBBER: 'dr', 'dead', 'dead r', 'dead rubber' (check before DEFAULTED since both start with 'd')
  const deadRubberPattern = /^(dr|dead(\s*r(ubber)?)?)/i;
  if (deadRubberPattern.exec(remaining)) {
    return { ending: DEAD_RUBBER, endPos: input.length };
  }

  // RETIRED: 'r', 'ret', 'retired'
  const retiredPattern = /^r(et(ired?)?)?/i;
  if (retiredPattern.exec(remaining)) {
    return { ending: RETIRED, endPos: input.length };
  }

  // WALKOVER: 'w', 'wo', 'w/o', 'walkover'
  const walkoverPattern = /^(w(\/o|o|alk(over?)?)?)/i;
  if (walkoverPattern.exec(remaining)) {
    return { ending: WALKOVER, endPos: input.length };
  }

  // DEFAULTED: 'd', 'def', 'defaulted'
  const defaultedPattern = /^d(ef(aulted?)?)?/i;
  if (defaultedPattern.exec(remaining)) {
    return { ending: DEFAULTED, endPos: input.length };
  }

  // SUSPENDED: 's', 'susp', 'suspended'
  const suspendedPattern = /^s(usp(ended?)?)?/i;
  if (suspendedPattern.exec(remaining)) {
    return { ending: SUSPENDED, endPos: input.length };
  }

  // CANCELLED: 'c', 'canc', 'cancelled', 'canceled'
  const cancelledPattern = /^c(anc(ell?ed?)?)?/i;
  if (cancelledPattern.exec(remaining)) {
    return { ending: CANCELLED, endPos: input.length };
  }

  // AWAITING RESULT: 'a', 'await', 'awaiting', 'awaiting result'
  const awaitingPattern = /^a(wait(ing(\s*r(esult)?)?)?)?/i;
  if (awaitingPattern.exec(remaining)) {
    return { ending: AWAITING_RESULT, endPos: input.length };
  }

  return { endPos: startPos };
}

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
  return char >= '0' && char <= '9';
}

/**
 * Check if string contains only digits
 */
function isAllDigits(str: string): boolean {
  for (const char of str) {
    if (!isDigit(char)) {
      return false;
    }
  }
  return true;
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
function isTiebreakComplete(side1: number, side2: number, setFormat: any): boolean {
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

/**
 * Parse a tiebreak set score (1-0 or 0-1)
 */
function parseTiebreakSet(setString: string, setNumber: number): ParsedSet {
  const side1 = setString === '1-0' ? 1 : 0;
  const side2 = setString === '0-1' ? 1 : 0;

  return {
    side1TiebreakScore: side1,
    side2TiebreakScore: side2,
    setNumber,
    winningSide: side1 > side2 ? 1 : 2,
  };
}

/**
 * Parse a regular timed set score (#-#)
 */
function parseRegularTimedSet(setString: string, setNumber: number, errors: ParseError[]): ParsedSet | null {
  const dashIndex = setString.indexOf('-');

  if (dashIndex === -1) {
    errors.push({
      position: 0,
      message: `Set ${setNumber}: Invalid format "${setString}". Expected "#-#" (e.g., "5-3")`,
      expected: '#-#',
      got: setString,
    });
    return null;
  }

  const side1Str = setString.slice(0, dashIndex);
  const side2Str = setString.slice(dashIndex + 1);

  if (!side1Str || !side2Str || !isAllDigits(side1Str) || !isAllDigits(side2Str)) {
    errors.push({
      position: 0,
      message: `Set ${setNumber}: Invalid format "${setString}". Expected "#-#" (e.g., "5-3")`,
      expected: '#-#',
      got: setString,
    });
    return null;
  }

  const side1 = Number.parseInt(side1Str, 10);
  const side2 = Number.parseInt(side2Str, 10);

  return {
    side1Score: side1,
    side2Score: side2,
    setNumber,
  };
}

/**
 * Parse final set when conditional tiebreak expected but pattern doesn't match
 */
function parseFinalSetWithConditionalTB(setString: string, setNumber: number, errors: ParseError[]): ParsedSet | null {
  const dashIndex = setString.indexOf('-');

  if (dashIndex === -1) {
    errors.push({
      position: 0,
      message: `Final set: Invalid format "${setString}". Expected TB format "1-0" or "0-1", or regular "#-#"`,
      expected: '1-0, 0-1, or #-#',
      got: setString,
    });
    return null;
  }

  const side1Str = setString.slice(0, dashIndex);
  const side2Str = setString.slice(dashIndex + 1);

  if (!side1Str || !side2Str || !isAllDigits(side1Str) || !isAllDigits(side2Str)) {
    errors.push({
      position: 0,
      message: `Final set: Invalid format "${setString}". Expected TB format "1-0" or "0-1", or regular "#-#"`,
      expected: '1-0, 0-1, or #-#',
      got: setString,
    });
    return null;
  }

  const side1 = Number.parseInt(side1Str, 10);
  const side2 = Number.parseInt(side2Str, 10);

  return {
    side1Score: side1,
    side2Score: side2,
    setNumber,
  };
}

/**
 * Calculate aggregate totals from timed sets
 */
function calculateAggregateTotals(sets: ParsedSet[], count: number): { side1: number; side2: number } {
  return sets.slice(0, count).reduce(
    (totals, set) => {
      totals.side1 += set.side1Score || 0;
      totals.side2 += set.side2Score || 0;
      return totals;
    },
    { side1: 0, side2: 0 },
  );
}

/**
 * Validate aggregate scoring with conditional tiebreak
 */
function validateAggregateScoring(
  sets: ParsedSet[],
  timedSetsCount: number,
  errors: ParseError[],
): void {
  const timedSets = sets.filter((s) => s.side1Score !== undefined);
  const hasTBSet = sets.some((s) => s.side1TiebreakScore !== undefined);

  if (timedSets.length < timedSetsCount) {
    return; // Not enough sets to validate yet
  }

  const aggregateTotals = calculateAggregateTotals(timedSets, timedSetsCount);
  const aggregateTied = aggregateTotals.side1 === aggregateTotals.side2;
  const finalSetIsTimed = timedSets.length > timedSetsCount;

  if (aggregateTied && !hasTBSet) {
    if (finalSetIsTimed) {
      const finalSet = timedSets[timedSetsCount];
      errors.push({
        position: 0,
        message: `Aggregate tied (${aggregateTotals.side1}-${aggregateTotals.side2}). Final set score "${finalSet.side1Score}-${finalSet.side2Score}" invalid. TB1 only accepts "1-0" or "0-1"`,
      });
    } else {
      errors.push({
        position: 0,
        message: `Aggregate tied (${aggregateTotals.side1}-${aggregateTotals.side2}), final TB required`,
      });
    }
  } else if (!aggregateTied && hasTBSet) {
    errors.push({
      position: 0,
      message: `Aggregate not tied (${aggregateTotals.side1}-${aggregateTotals.side2}), final TB not allowed`,
    });
  } else if (!aggregateTied && finalSetIsTimed) {
    errors.push({
      position: 0,
      message: `Aggregate not tied (${aggregateTotals.side1}-${aggregateTotals.side2}), extra sets not allowed`,
    });
  }
}

/**
 * Parse individual set strings into ParsedSet objects
 */
function parseTimedSetStrings(
  setStrings: string[],
  conditionalFinalTB: boolean,
  expectedSetCount: number,
  errors: ParseError[],
): ParsedSet[] {
  const sets: ParsedSet[] = [];

  for (let i = 0; i < setStrings.length; i++) {
    const setString = setStrings[i];
    const setNumber = i + 1;
    const isFinalSetPosition = setNumber === expectedSetCount;
    const matchesTBPattern = setString === '1-0' || setString === '0-1';
    const isTBSet = conditionalFinalTB && isFinalSetPosition && matchesTBPattern;

    if (isTBSet) {
      sets.push(parseTiebreakSet(setString, setNumber));
    } else if (conditionalFinalTB && isFinalSetPosition && !matchesTBPattern) {
      const set = parseFinalSetWithConditionalTB(setString, setNumber, errors);
      if (set) sets.push(set);
    } else {
      const set = parseRegularTimedSet(setString, setNumber, errors);
      if (set) sets.push(set);
    }
  }

  return sets;
}

/**
 * Create empty input result for timed exactly format
 */
function createEmptyTimedExactlyResult(conditionalFinalTB: boolean, expectedSetCount: number): ParseResult {
  return {
    valid: false,
    formattedScore: '',
    sets: [],
    confidence: 1,
    errors: [],
    warnings: [],
    ambiguities: [],
    suggestions: conditionalFinalTB
      ? [`Enter ${expectedSetCount - 1} timed sets (final TB only if tied)`]
      : [`Enter ${expectedSetCount} sets in format: #-# #-# ...`],
    incomplete: true,
    matchComplete: false,
  };
}

/**
 * Validate set count for timed exactly format
 */
function validateTimedSetCount(
  setsLength: number,
  minSets: number,
  maxSets: number,
  conditionalFinalTB: boolean,
  errors: ParseError[],
): void {
  if (setsLength > maxSets) {
    const expectedSetsText = conditionalFinalTB ? `${minSets}-${maxSets}` : `${maxSets}`;
    errors.push({
      position: 0,
      message: `Too many sets: got ${setsLength}, expected ${expectedSetsText}`,
    });
  }
}

/**
 * Generate suggestions for incomplete timed sets
 */
function generateTimedSetSuggestions(
  incomplete: boolean,
  conditionalFinalTB: boolean,
  minSets: number,
  setsLength: number,
  expectedSetCount: number,
): string[] {
  if (!incomplete) return [];

  if (conditionalFinalTB) {
    const remaining = minSets - setsLength;
    return [`Enter ${remaining} more timed set${remaining === 1 ? '' : 's'} (or final TB if aggregate tied)`];
  }

  const remaining = expectedSetCount - setsLength;
  return [`Need ${remaining} more set${remaining === 1 ? '' : 's'}`];
}

/**
 * Format timed sets for output
 */
function formatTimedSets(sets: ParsedSet[]): string {
  return sets
    .map((s) =>
      s.side1TiebreakScore !== undefined
        ? `${s.side1TiebreakScore}-${s.side2TiebreakScore}`
        : `${s.side1Score}-${s.side2Score}`,
    )
    .join(' ');
}

/**
 * Simple parser for timed sets with exactly format
 * For formats like SET3X-S:T10, expects exactly N sets in "#-#" format
 * For aggregate with conditional TB (SET3X-S:T10A-F:TB1):
 *   - Accepts N-1 sets if aggregate not tied (match ends early)
 *   - Requires N sets with final TB if aggregate tied
 * No smart logic - just parse literal "#-# #-# #-#" patterns
 */
function parseTimedExactlyScore(input: string, parsedFormat: ParsedFormat): ParseResult {
  const expectedSetCount = parsedFormat.exactly || parsedFormat.bestOf || 1;
  const trimmedInput = input.trim();

  const isAggregateScoring = parsedFormat.setFormat?.based === 'A' || parsedFormat.finalSetFormat?.based === 'A';
  const hasFinalTiebreak = parsedFormat.finalSetFormat?.tiebreakSet?.tiebreakTo !== undefined;
  const conditionalFinalTB = isAggregateScoring && hasFinalTiebreak;

  if (!trimmedInput) {
    return createEmptyTimedExactlyResult(conditionalFinalTB, expectedSetCount);
  }

  const setStrings = trimmedInput.split(/\s+/);
  const errors: ParseError[] = [];
  const timedSetsCount = conditionalFinalTB ? expectedSetCount - 1 : expectedSetCount;

  const sets = parseTimedSetStrings(setStrings, conditionalFinalTB, expectedSetCount, errors);

  if (conditionalFinalTB && errors.length === 0) {
    validateAggregateScoring(sets, timedSetsCount, errors);
  }

  const minSets = conditionalFinalTB ? timedSetsCount : expectedSetCount;
  const maxSets = expectedSetCount;

  validateTimedSetCount(sets.length, minSets, maxSets, conditionalFinalTB, errors);

  const incomplete = sets.length < minSets && errors.length === 0;
  const matchComplete =
    (sets.length === expectedSetCount || (conditionalFinalTB && sets.length === timedSetsCount)) && errors.length === 0;

  const formattedScore = formatTimedSets(sets);

  return {
    valid: errors.length === 0 && (sets.length === minSets || sets.length === maxSets),
    formattedScore,
    sets,
    confidence: errors.length === 0 ? 1 : 0,
    errors,
    warnings: [],
    ambiguities: [],
    suggestions: generateTimedSetSuggestions(incomplete, conditionalFinalTB, minSets, sets.length, expectedSetCount),
    incomplete,
    matchComplete,
  };
}

// ============================================================================
// Main Parser Function
// ============================================================================

/**
 * Parse free-form score string using matchUpFormat context
 */
export function parseScore(input: string, matchUpFormat: string | ParsedFormat): ParseResult {
  // Parse format if string provided
  const parsedFormat = typeof matchUpFormat === 'string' ? matchUpFormatCode.parse(matchUpFormat) : matchUpFormat;

  if (!parsedFormat) {
    return {
      valid: false,
      formattedScore: '',
      sets: [],
      confidence: 0,
      errors: [
        {
          position: 0,
          message: 'Invalid matchUpFormat',
        },
      ],
      warnings: [],
      ambiguities: [],
      suggestions: [],
      incomplete: false,
      matchComplete: false,
    };
  }

  // IMPORTANT: For timed sets with exactly format, use simple parsing
  // No smart logic, just expect exact number of "#-#" entries
  const isTimed = !!(parsedFormat.setFormat?.timed || parsedFormat.finalSetFormat?.timed);
  const isExactlyFormat = !!parsedFormat.exactly || parsedFormat.bestOf === 1;

  if (isTimed && isExactlyFormat) {
    return parseTimedExactlyScore(input, parsedFormat);
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
    confidence: 1,
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

  // Handle irregular endings
  let finalSets = state.sets;
  let matchUpStatus: string | undefined;

  if (state.irregularEnding) {
    matchUpStatus = state.irregularEnding;

    // Remove score for statuses where match didn't start or wasn't played
    if (
      state.irregularEnding === WALKOVER ||
      state.irregularEnding === CANCELLED ||
      state.irregularEnding === DEAD_RUBBER
    ) {
      finalSets = [];
    }
    // Keep score for other statuses (RETIRED, DEFAULTED, SUSPENDED, INCOMPLETE, IN_PROGRESS, AWAITING_RESULT)
  }

  // Check if match is complete
  const matchComplete = state.irregularEnding ? false : checkMatchComplete(state);

  // Format output
  const formattedScore = formatScore(state);

  return {
    valid: state.isValid && state.errors.length === 0,
    formattedScore,
    sets: finalSets,
    confidence: state.confidence,
    errors: state.errors,
    warnings: state.warnings,
    ambiguities: state.ambiguities,
    suggestions: state.suggestions,
    incomplete: !matchComplete && finalSets.length > 0,
    matchComplete,
    matchUpStatus,
  };
}

/**
 * Process a single character from input
 */
function processCharacter(state: ParserState): void {
  const char = state.input[state.position];

  // Check for irregular endings (RET, WO, DEF, etc.)
  // These can appear after a score or by themselves
  if (!isDigit(char) && !isTiebreakIndicator(char) && !isTiebreakCloser(char)) {
    const detection = detectIrregularEnding(state.input, state.position);
    if (detection.ending) {
      state.irregularEnding = detection.ending;
      state.irregularEndingPosition = state.position;
      state.position = detection.endPos; // Skip to end of input
      return;
    }
  }

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
    // Check if set requires a tiebreak
    const side1Score = Number.parseInt(state.currentSide1Buffer);
    const side2Score = Number.parseInt(state.currentSide2Buffer);
    const currentSetFormat = getSetFormat(state.parsedFormat, state.setIndex);

    if (requiresTiebreak(side1Score, side2Score, currentSetFormat)) {
      // Transition to tiebreak parsing - next digits are the tiebreak score
      state.inTiebreak = true;
      state.state = TokenizerState.PARSING_TIEBREAK_SIDE1;
      state.position++;
      return;
    }

    // Otherwise finalize the set normally
    finalizeSet(state);
    state.position++;
    return;
  }

  if (state.state === TokenizerState.PARSING_TIEBREAK_SIDE1 && state.currentTiebreakSide1Buffer) {
    // Check if this is a set tiebreak (has game scores) or match tiebreak (tiebreak-only)
    const isSetTiebreak = state.currentSide1Buffer && state.currentSide2Buffer;

    if (isSetTiebreak) {
      // Set tiebreak: only need one score (the losing score) - finalize the set
      finalizeSet(state);
      state.position++;
      return;
    } else {
      // Match tiebreak: need both scores - transition to side2
      state.state = TokenizerState.PARSING_TIEBREAK_SIDE2;
      state.position++;
      return;
    }
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
 * Check if adding the next digit would exceed the maximum game score
 */
function wouldExceedMaxScore(buffer: string, nextDigit: string, maxGameScore: number): boolean {
  const twoDigitValue = Number.parseInt(buffer + nextDigit);
  return twoDigitValue > maxGameScore;
}

/**
 * Handle digit for side1 game score
 */
function handleSide1GameDigit(state: ParserState, char: string, maxGameScore: number): void {
  state.state = TokenizerState.PARSING_SIDE1;
  state.currentSide1Buffer += char;

  const currentValue = Number.parseInt(state.currentSide1Buffer);
  const nextPos = state.position + 1;

  if (nextPos < state.input.length && isDigit(state.input[nextPos])) {
    const nextDigit = state.input[nextPos];

    if (wouldExceedMaxScore(state.currentSide1Buffer, nextDigit, maxGameScore)) {
      state.warnings.push(
        `Potential score issue: "${state.currentSide1Buffer}${nextDigit}" would exceed max game score ${maxGameScore}`,
      );
      state.state = TokenizerState.PARSING_SIDE2;
    }
  } else {
    state.state = TokenizerState.PARSING_SIDE2;
  }

  if (currentValue > maxGameScore) {
    state.warnings.push(`Score ${currentValue} exceeds max ${maxGameScore} at position ${state.position}`);
  }

  state.position++;
}

/**
 * Handle digit for side2 game score
 */
function handleSide2GameDigit(state: ParserState, char: string, setFormat: any, maxGameScore: number): void {
  state.currentSide2Buffer += char;

  const side1 = Number.parseInt(state.currentSide1Buffer);
  const side2 = Number.parseInt(state.currentSide2Buffer);

  if (requiresTiebreak(side1, side2, setFormat)) {
    state.inTiebreak = true;
    state.state = TokenizerState.PARSING_TIEBREAK_SIDE1;
    state.position++;
    return;
  }

  const nextPos = state.position + 1;

  if (nextPos < state.input.length && isDigit(state.input[nextPos])) {
    const nextDigit = state.input[nextPos];

    if (wouldExceedMaxScore(state.currentSide2Buffer, nextDigit, maxGameScore)) {
      const isValid = isSetComplete(side1, side2, setFormat) || shouldEnterTiebreak(side1, side2, setFormat);
      if (!isValid) {
        state.warnings.push(`Set ${state.setIndex + 1} may be incomplete: ${side1}-${side2}`);
      }
      finalizeSet(state);
    }
  }

  state.position++;
}

/**
 * Handle digit in game score context
 */
function handleGameDigit(state: ParserState, char: string, setFormat: any): void {
  const maxGameScore = getMaxGameScore(setFormat);

  if (state.state === TokenizerState.PARSING_SIDE1 || state.state === TokenizerState.START) {
    handleSide1GameDigit(state, char, maxGameScore);
    return;
  }

  if (state.state === TokenizerState.PARSING_SIDE2) {
    handleSide2GameDigit(state, char, setFormat, maxGameScore);
    return;
  }

  state.position++;
}

/**
 * Handle digit in tiebreak side1 context
 */
function handleTiebreakSide1Digit(state: ParserState, char: string): void {
  state.currentTiebreakSide1Buffer += char;

  // Just keep buffering - separator will finalize
  // Don't try to be smart about when to stop
  state.position++;
}

/**
 * Handle digit in tiebreak side2 context
 */
function handleTiebreakSide2Digit(state: ParserState, char: string, setFormat: any): void {
  state.currentTiebreakSide2Buffer += char;

  const currentValue = Number.parseInt(state.currentTiebreakSide2Buffer);
  const nextPos = state.position + 1;

  if (nextPos < state.input.length && isDigit(state.input[nextPos])) {
    const nextDigit = state.input[nextPos];
    const twoDigitValue = Number.parseInt(state.currentTiebreakSide2Buffer + nextDigit);

    // Check if we should finalize based on the same logic as side1
    // If two-digit would be unreasonable, current value is complete
    const side1 = Number.parseInt(state.currentTiebreakSide1Buffer);

    // Sanity check: absurdly large numbers indicate error or end of tiebreak
    const absurdMax = 999;
    const shouldFinalize = twoDigitValue > absurdMax;

    if (shouldFinalize) {
      const side2 = currentValue;
      const isComplete = isTiebreakComplete(side1, side2, setFormat);
      if (!isComplete) {
        state.warnings.push(`Tiebreak may be incomplete: ${side1}-${side2}`);
      }
      finalizeSet(state);
    }
  }

  state.position++;
}

/**
 * Handle digit in tiebreak score context
 */
function handleTiebreakDigit(state: ParserState, char: string, setFormat: any): void {
  if (state.state === TokenizerState.PARSING_TIEBREAK_SIDE1) {
    handleTiebreakSide1Digit(state, char);
    return;
  }

  if (state.state === TokenizerState.PARSING_TIEBREAK_SIDE2) {
    handleTiebreakSide2Digit(state, char, setFormat);
    return;
  }

  state.position++;
}

/**
 * Create a tiebreak-only set (match tiebreak)
 */
function createTiebreakOnlySet(state: ParserState): ParsedSet | null {
  if (!state.currentTiebreakSide1Buffer || !state.currentTiebreakSide2Buffer) {
    return null; // Incomplete tiebreak
  }

  const tb1 = Number.parseInt(state.currentTiebreakSide1Buffer);
  const tb2 = Number.parseInt(state.currentTiebreakSide2Buffer);

  return {
    side1Score: 0, // No game scores for tiebreak-only
    side2Score: 0,
    side1TiebreakScore: tb1,
    side2TiebreakScore: tb2,
    setNumber: state.setIndex + 1,
    winningSide: tb1 > tb2 ? 1 : 2,
  };
}

/**
 * Add tiebreak scores to a regular set
 */
function addTiebreakScores(set: ParsedSet, state: ParserState, currentSetFormat: any): void {
  const tb1Str = state.currentTiebreakSide1Buffer;
  const tb2Str = state.currentTiebreakSide2Buffer;

  if (tb1Str && tb2Str) {
    // Both scores provided
    set.side1TiebreakScore = Number.parseInt(tb1Str);
    set.side2TiebreakScore = Number.parseInt(tb2Str);
  } else if (tb1Str || tb2Str) {
    // Only one score provided - infer the other
    inferMissingTiebreakScore(set, tb1Str, tb2Str, currentSetFormat);
  }
}

/**
 * Infer missing tiebreak score when only one is provided
 */
function inferMissingTiebreakScore(set: ParsedSet, tb1Str: string, tb2Str: string, setFormat: any): void {
  const losingScore = Number.parseInt(tb1Str || tb2Str);
  const tiebreakLimit = getTiebreakLimit(setFormat);
  const isNoAd = setFormat?.tiebreakFormat?.NoAD;

  // Infer winning score (must be at least tiebreakTo and win by 2, unless NoAD)
  const minWinningScore = isNoAd ? tiebreakLimit : Math.max(tiebreakLimit, losingScore + 2);

  // Determine which side won based on game scores
  if (set.side1Score! > set.side2Score!) {
    // Side 1 won, so tb2Str is losing score
    set.side1TiebreakScore = minWinningScore;
    set.side2TiebreakScore = losingScore;
  } else {
    // Side 2 won, so tb1Str is losing score
    set.side1TiebreakScore = losingScore;
    set.side2TiebreakScore = minWinningScore;
  }
}

/**
 * Check if set scores require a tiebreak based on format rules
 */
function requiresTiebreak(side1Score: number, side2Score: number, setFormat: any): boolean {
  const tiebreakAt = setFormat.tiebreakAt || setFormat.setTo || 6;

  // Check if both scores are at tiebreakAt and differ by exactly 1
  const atTiebreak =
    (side1Score === tiebreakAt && side2Score === tiebreakAt + 1) ||
    (side2Score === tiebreakAt && side1Score === tiebreakAt + 1);

  return atTiebreak;
}

/**
 * Create a regular set with game scores
 */
function createRegularSet(state: ParserState, currentSetFormat: any): ParsedSet | null {
  if (!state.currentSide1Buffer || !state.currentSide2Buffer) {
    return null; // Incomplete set
  }

  const side1Score = Number.parseInt(state.currentSide1Buffer);
  const side2Score = Number.parseInt(state.currentSide2Buffer);

  // CRITICAL: Check if this set requires a tiebreak but doesn't have one yet
  if (
    requiresTiebreak(side1Score, side2Score, currentSetFormat) &&
    !state.currentTiebreakSide1Buffer &&
    !state.currentTiebreakSide2Buffer
  ) {
    // Set is incomplete - needs tiebreak score
    return null;
  }

  const set: ParsedSet = {
    side1Score,
    side2Score,
    setNumber: state.setIndex + 1,
  };

  // Add tiebreak scores if present
  if (state.currentTiebreakSide1Buffer || state.currentTiebreakSide2Buffer) {
    addTiebreakScores(set, state, currentSetFormat);
  }

  // Determine winner from game scores
  if (side1Score > side2Score) {
    set.winningSide = 1;
  } else if (side2Score > side1Score) {
    set.winningSide = 2;
  }

  return set;
}

/**
 * Reset state buffers and prepare for next set
 */
function resetStateForNextSet(state: ParserState): void {
  state.currentSide1Buffer = '';
  state.currentSide2Buffer = '';
  state.currentTiebreakSide1Buffer = '';
  state.currentTiebreakSide2Buffer = '';
  state.setIndex++;
  state.inTiebreak = false; // Reset tiebreak flag
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
 * Finalize current set and move to next
 */
function finalizeSet(state: ParserState): void {
  const currentSetFormat = getSetFormat(state.parsedFormat, state.setIndex);
  const isTiebreakOnly = isTiebreakOnlySet(currentSetFormat);

  let set: ParsedSet | null = null;

  if (isTiebreakOnly) {
    set = createTiebreakOnlySet(state);
  } else {
    set = createRegularSet(state, currentSetFormat);
  }

  if (set) {
    state.sets.push(set);
  }

  resetStateForNextSet(state);
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
  if (
    state.currentSide1Buffer ||
    state.currentSide2Buffer ||
    state.currentTiebreakSide1Buffer ||
    state.currentTiebreakSide2Buffer
  ) {
    finalizeSet(state);
  }
}

/**
 * Check if match is complete
 */
function checkMatchComplete(state: ParserState): boolean {
  const bestOf = state.parsedFormat.bestOf || 3;
  const setsNeeded = Math.ceil(bestOf / 2);

  const side1Wins = state.sets.filter((s) => s.winningSide === 1).length;
  const side2Wins = state.sets.filter((s) => s.winningSide === 2).length;

  return side1Wins >= setsNeeded || side2Wins >= setsNeeded;
}

/**
 * Format the parsed score for output
 */
function formatScore(state: ParserState): string {
  const parts: string[] = [];

  for (const set of state.sets) {
    // Check if this is a tiebreak-only set (no game scores, only tiebreak scores)
    const isTiebreakOnly =
      (!set.side1Score || set.side1Score === 0) &&
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
