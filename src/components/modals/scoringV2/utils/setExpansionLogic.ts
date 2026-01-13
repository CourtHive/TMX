/**
 * Logic for determining when to expand set inputs dynamically
 */
import { matchUpFormatCode } from 'tods-competition-factory';
import type { SetScore } from '../types';

type MatchUpFormatInfo = {
  bestOf: number;
  exactly?: number;
  setsToWin: number;
  isTimed: boolean;
  isExactlyFormat: boolean;
};

/**
 * Parse match format string to extract best-of information
 * Examples: "SET3-S:6/TB7" → bestOf=3, "SET5-S:6/TB7" → bestOf=5
 * Examples: "SET3X-S:T10" → exactly=3, isTimed=true
 */
export function parseMatchUpFormat(matchUpFormat?: string): MatchUpFormatInfo {
  if (!matchUpFormat) {
    return { bestOf: 3, setsToWin: 2, isTimed: false, isExactlyFormat: false };
  }

  // Parse using factory to get detailed information
  const parsed = matchUpFormatCode.parse(matchUpFormat);
  
  if (!parsed) {
    // Fallback to simple parsing if factory fails
    const setMatch = matchUpFormat.match(/SET(\d+)/);
    const bestOf = setMatch ? Number.parseInt(setMatch[1], 10) : 3;
    const setsToWin = Math.ceil(bestOf / 2);
    return { bestOf, setsToWin, isTimed: false, isExactlyFormat: false };
  }

  // Check if this is a timed set format
  const isTimed = !!(parsed.setFormat?.timed || parsed.finalSetFormat?.timed);
  
  // Determine if this is an "exactly" format (exactly:N or bestOf:1)
  // Note: bestOf:1 is functionally the same as exactly:1
  const isExactlyFormat = !!parsed.exactly || parsed.bestOf === 1;
  const setCount = parsed.exactly || parsed.bestOf || 3;
  
  // For exactly formats or bestOf:1, we know the exact number of sets
  // For bestOf, calculate sets needed to win
  const setsToWin = isExactlyFormat ? setCount : Math.ceil(setCount / 2);

  return {
    bestOf: parsed.bestOf || setCount,
    exactly: parsed.exactly,
    setsToWin,
    isTimed,
    isExactlyFormat,
  };
}

/**
 * Determine if another set should be added based on current scores
 */
export function shouldExpandSets(sets: SetScore[], matchUpFormat?: string): boolean {
  if (!sets || sets.length === 0) return true;

  const formatInfo = parseMatchUpFormat(matchUpFormat);
  const { bestOf, isExactlyFormat, setsToWin } = formatInfo;
  const totalSets = formatInfo.exactly || bestOf;

  // For "exactly" formats (exactly:N or bestOf:1), show all sets immediately
  // This is because we know the exact number of sets that will be played
  // For timed sets, scores don't determine winners, so all sets must be played
  if (isExactlyFormat) {
    // Don't expand beyond the exact number of sets
    if (sets.length >= totalSets) {
      return false;
    }
    // Always show all sets for exactly formats
    return true;
  }

  // For regular bestOf formats, use dynamic expansion based on scores
  // Calculate sets won per side
  const setsWon = { side1: 0, side2: 0 };
  
  sets.forEach(set => {
    const s1 = set.side1Score ?? 0;
    const s2 = set.side2Score ?? 0;
    
    if (s1 > s2) setsWon.side1++;
    else if (s2 > s1) setsWon.side2++;
  });

  // Don't expand if match is already decided
  if (setsWon.side1 >= setsToWin || setsWon.side2 >= setsToWin) {
    return false;
  }

  // Don't expand beyond maximum sets
  if (sets.length >= bestOf) {
    return false;
  }

  // Check if all current sets are filled
  const allSetsFilled = sets.every(set => 
    set.side1Score !== undefined && 
    set.side2Score !== undefined &&
    set.side1Score !== null &&
    set.side2Score !== null
  );

  // Expand if all sets filled and match not decided
  return allSetsFilled;
}

/**
 * Determine the winning side based on set scores
 */
export function determineWinningSide(sets: SetScore[], matchUpFormat?: string): number | undefined {
  if (!sets || sets.length === 0) return undefined;

  const { setsToWin } = parseMatchUpFormat(matchUpFormat);
  
  const setsWon = { side1: 0, side2: 0 };
  
  sets.forEach(set => {
    const s1 = set.side1Score ?? 0;
    const s2 = set.side2Score ?? 0;
    
    if (s1 > s2) setsWon.side1++;
    else if (s2 > s1) setsWon.side2++;
  });

  if (setsWon.side1 >= setsToWin) return 1;
  if (setsWon.side2 >= setsToWin) return 2;
  
  return undefined;
}
