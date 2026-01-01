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
  const setTo = parsedFormat?.setFormat?.setTo || 6;
  const tiebreakAt = parsedFormat?.setFormat?.tiebreakAt || setTo;
  
  let result = '';
  let i = 0;
  
  while (i < digits.length) {
    let side1 = '';
    let side2 = '';
    let tb1 = '';
    let tb2 = '';
    
    // Parse side1
    while (i < digits.length) {
      side1 += digits[i];
      const val = parseInt(side1);
      i++;
      // Break if: 2 digits OR single digit > setTo
      if (side1.length >= 2 || (side1.length === 1 && val > setTo)) break;
    }
    
    // Parse side2
    while (i < digits.length) {
      side2 += digits[i];
      const val = parseInt(side2);
      i++;
      // Break if: 2 digits OR single digit > setTo
      if (side2.length >= 2 || (side2.length === 1 && val > setTo)) break;
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
      // Parse tiebreak scores
      while (i < digits.length && tb1.length < 2) {
        tb1 += digits[i];
        i++;
      }
      while (i < digits.length && tb2.length < 2) {
        tb2 += digits[i];
        i++;
      }
      
      if (result) result += ' ';
      if (tb2) {
        result += `${side1}-${side2}(${tb1}-${tb2})`;
      } else if (tb1) {
        result += `${side1}-${side2}(${tb1}`;
      } else {
        result += `${side1}-${side2}(`;
      }
    } else {
      // Regular set
      if (result) result += ' ';
      result += `${side1}-${side2}`;
    }
  }
  
  return result;
}
