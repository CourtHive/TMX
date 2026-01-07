/**
 * Logic for determining when to expand set inputs dynamically
 */
import type { SetScore } from '../types';

type MatchUpFormatInfo = {
  bestOf: number;
  setsToWin: number;
};

/**
 * Parse match format string to extract best-of information
 * Examples: "SET3-S:6/TB7" → bestOf=3, "SET5-S:6/TB7" → bestOf=5
 */
export function parseMatchUpFormat(matchUpFormat?: string): MatchUpFormatInfo {
  if (!matchUpFormat) {
    return { bestOf: 3, setsToWin: 2 };
  }

  // Try to extract SET number from format string
  const setMatch = matchUpFormat.match(/SET(\d+)/);
  const bestOf = setMatch ? Number.parseInt(setMatch[1], 10) : 3;
  const setsToWin = Math.ceil(bestOf / 2);

  return { bestOf, setsToWin };
}

/**
 * Determine if another set should be added based on current scores
 */
export function shouldExpandSets(sets: SetScore[], matchUpFormat?: string): boolean {
  if (!sets || sets.length === 0) return true;

  const { bestOf, setsToWin } = parseMatchUpFormat(matchUpFormat);

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
