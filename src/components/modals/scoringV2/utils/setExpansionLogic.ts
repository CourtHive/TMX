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
    // If factory parse fails, return default SET3 format
    // Never use regex to parse matchUpFormat strings!
    return { bestOf: 3, setsToWin: 2, isTimed: false, isExactlyFormat: false };
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
  // EXCEPT for aggregate scoring with conditional final tiebreak
  if (isExactlyFormat) {
    // Don't expand beyond the exact number of sets
    if (sets.length >= totalSets) {
      return false;
    }
    
    // Special case: Aggregate scoring with conditional final tiebreak (e.g., SET3X-S:T10A-F:TB1)
    const parsed = matchUpFormatCode.parse(matchUpFormat);
    const isAggregateScoring = 
      parsed?.setFormat?.based === 'A' || parsed?.finalSetFormat?.based === 'A';
    const hasFinalTiebreak = parsed?.finalSetFormat?.tiebreakSet?.tiebreakTo !== undefined;
    
    if (isAggregateScoring && hasFinalTiebreak && formatInfo.isTimed) {
      // For SET3X-S:T10A-F:TB1: Show sets 1-2, then check aggregate
      // For SET4X-S:T10A-F:TB1: Show sets 1-3, then check aggregate
      const timedSetsCount = totalSets - 1; // Final set is TB, so timed sets = totalSets - 1
      
      if (sets.length < timedSetsCount) {
        // Still need to show timed sets
        return true;
      } else if (sets.length === timedSetsCount) {
        // All timed sets entered, check if aggregate is tied
        const aggregateTotals = sets.reduce(
          (totals, set) => {
            if (set.side1Score !== undefined && set.side1Score !== null) {
              totals.side1 += set.side1Score;
            }
            if (set.side2Score !== undefined && set.side2Score !== null) {
              totals.side2 += set.side2Score;
            }
            return totals;
          },
          { side1: 0, side2: 0 }
        );
        
        // Only show final TB if aggregate is tied
        return aggregateTotals.side1 === aggregateTotals.side2;
      } else {
        // Already at or past totalSets
        return false;
      }
    }
    
    // Always show all sets for exactly formats (non-aggregate or no conditional TB)
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
 * Handles both regular scoring (sets won) and aggregate scoring (total points)
 */
export function determineWinningSide(sets: SetScore[], matchUpFormat?: string): number | undefined {
  if (!sets || sets.length === 0) return undefined;

  // Check if this is aggregate scoring
  const parsed = matchUpFormat ? matchUpFormatCode.parse(matchUpFormat) : null;
  const isAggregateScoring = 
    parsed?.setFormat?.based === 'A' || parsed?.finalSetFormat?.based === 'A';

  if (isAggregateScoring) {
    // For aggregate scoring, winner is determined by total score across all sets
    const aggregateTotals = sets.reduce(
      (totals, set) => {
        // Only count sets with actual scores (not tiebreak-only sets without side scores)
        if (set.side1Score !== undefined && set.side1Score !== null) {
          totals.side1 += set.side1Score;
        }
        if (set.side2Score !== undefined && set.side2Score !== null) {
          totals.side2 += set.side2Score;
        }
        return totals;
      },
      { side1: 0, side2: 0 }
    );

    if (aggregateTotals.side1 > aggregateTotals.side2) return 1;
    if (aggregateTotals.side2 > aggregateTotals.side1) return 2;
    
    // If aggregate is tied, check for final tiebreak set
    const finalSet = sets[sets.length - 1];
    if (finalSet?.side1TiebreakScore !== undefined || finalSet?.side2TiebreakScore !== undefined) {
      const tb1 = finalSet.side1TiebreakScore ?? 0;
      const tb2 = finalSet.side2TiebreakScore ?? 0;
      if (tb1 > tb2) return 1;
      if (tb2 > tb1) return 2;
    }
    
    return undefined; // Tied aggregate, no tiebreak yet
  }

  // Standard scoring: count sets won
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
