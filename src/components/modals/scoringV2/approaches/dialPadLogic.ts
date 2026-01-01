/**
 * Shared dial pad logic - formats raw digits into score string
 * Parses matchUpFormat to determine boundaries
 */

import { matchUpFormatCode } from 'tods-competition-factory';

export type FormatOptions = {
  matchUpFormat: string;
};

/**
 * Convert raw digits to formatted score string
 * Example: "6464" with matchUpFormat 'SET3-S:6/TB7' becomes "6-4 6-4"
 */
export function formatScoreString(digits: string, options: FormatOptions): string {
  const { matchUpFormat } = options;
  
  if (!digits) return '';
  
  // Parse matchUpFormat to get setTo and tiebreakAt
  const parsedFormat = matchUpFormatCode.parse(matchUpFormat);
  
  // For tiebreak-only sets (e.g., SET1-S:TB10), setTo comes from tiebreakSet.tiebreakTo
  const tiebreakSetTo = parsedFormat?.setFormat?.tiebreakSet?.tiebreakTo;
  const regularSetTo = parsedFormat?.setFormat?.setTo;
  
  const setTo = tiebreakSetTo || regularSetTo || 6;
  const tiebreakAt = parsedFormat?.setFormat?.tiebreakAt || setTo;
  

  
  let result = '';
  let i = 0;
  
  // Split by spaces first (space = explicit separator from minus key)
  const segments = digits.split(' ').filter(s => s.length > 0);
  
  for (const segment of segments) {
    i = 0;
    const segmentDigits = segment;
    
  while (i < segmentDigits.length) {
    let side1 = '';
    let side2 = '';
    let tb1 = '';
    let tb2 = '';
    
    // Parse side1
    while (i < segmentDigits.length) {
      const nextDigit = segmentDigits[i];
      const potentialValue = side1 + nextDigit;
      const val = parseInt(potentialValue);
      
      // Check if adding this digit would create a valid score
      // For setTo=4: valid scores are 0-5, so if val>5 after adding digit, stop
      // For setTo=6: valid scores are 0-7, so if val>7 after adding digit, stop
      // For setTo=10+: need to allow 2-digit scores (10, 11, 12, etc.)
      const maxScore = setTo + 1;
      
      // If we already have a digit and adding another would exceed maxScore, stop
      if (side1.length > 0) {
        if (val > maxScore) break;
        // Stop at 2 digits unless setTo allows higher (TB format)
        if (side1.length >= 2) break;
      }
      
      side1 += nextDigit;
      i++;
      
      // After adding, check if we should stop
      // Stop after 1 digit unless it's 1 (could be 10+) OR maxScore >= 10
      const currentVal = parseInt(side1);
      if (side1.length === 1 && currentVal !== 1 && maxScore < 10) break;
    }
    
    // Parse side2
    while (i < segmentDigits.length) {
      const nextDigit = segmentDigits[i];
      const potentialValue = side2 + nextDigit;
      const val = parseInt(potentialValue);
      
      const maxScore = setTo + 1;
      
      if (side2.length > 0) {
        if (val > maxScore) break;
        if (side2.length >= 2) break;
      }
      
      side2 += nextDigit;
      i++;
      
      const currentVal = parseInt(side2);
      if (side2.length === 1 && currentVal !== 1 && maxScore < 10) break;
    }
    
    if (!side2) {
      // Incomplete set
      if (result) result += ' ';
      result += side1;
      break;
    }
    
    const s1 = parseInt(side1);
    const s2 = parseInt(side2);
    
    // Check for tiebreak
    const needsTiebreak = (s1 === tiebreakAt && s2 === tiebreakAt) ||
                         (s1 === tiebreakAt + 1 && s2 === tiebreakAt) ||
                         (s2 === tiebreakAt + 1 && s1 === tiebreakAt);
    
    if (needsTiebreak) {
      // Parse tiebreak scores - look for explicit separator in remaining digits
      const remainingDigits = segmentDigits.slice(i);
      const separatorIndex = remainingDigits.indexOf('-');
      
      if (separatorIndex !== -1) {
        // Explicit separator found - tiebreak is complete, just take first score
        tb1 = remainingDigits.slice(0, separatorIndex);
        // Don't consume digits after separator - they belong to next set
        i += separatorIndex + 1;
        // The minus indicates tiebreak is complete - only one score entered
      } else {
        // No separator - consume all remaining digits as tiebreak score
        tb1 = remainingDigits;
        i = segmentDigits.length;
      }
      
      if (result) result += ' ';
      if (tb2) {
        result += `${side1}-${side2}(${tb1}-${tb2})`;
      } else if (tb1) {
        result += `${side1}-${side2}(${tb1})`;
      } else {
        result += `${side1}-${side2}(`;
      }
    } else {
      // Regular set
      if (result) result += ' ';
      result += `${side1}-${side2}`;
    }
  }
  
  } // end for segment
  
  return result;
}
