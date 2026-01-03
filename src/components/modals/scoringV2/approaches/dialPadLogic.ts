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

  const bestOf = parsedFormat?.setFormat?.bestOf || 3;
  
  // Helper to get format for a specific set (checking finalSetFormat for deciding set)
  const getSetFormat = (setNumber: number) => {
    const isDecidingSet = setNumber === bestOf;
    return isDecidingSet && parsedFormat?.finalSetFormat 
      ? parsedFormat.finalSetFormat 
      : parsedFormat?.setFormat;
  };
  


  let result = '';
  let i = 0;
  let setCount = 0;

  // Split on spaces, slashes, or consecutive minuses as set separators
  // Single minuses within a segment are kept for tiebreak/side separation
  const segments = digits.split(/[\s\/]+|--+/).filter((s) => s.length > 0);

  for (const segment of segments) {
    // Stop if we've already reached the maximum number of sets
    if (setCount >= bestOf) break;
    
    // Get format for the NEXT set we're about to parse (setCount is 0-based, add 1 for set number)
    const currentSetFormat = getSetFormat(setCount + 1);
    const currentTiebreakSetTo = currentSetFormat?.tiebreakSet?.tiebreakTo;
    const currentRegularSetTo = currentSetFormat?.setTo;
    const currentSetIsTiebreakOnly = !!currentTiebreakSetTo && !currentRegularSetTo;
    
    const setTo = currentTiebreakSetTo || currentRegularSetTo || 6;
    const tiebreakAt = currentSetFormat?.tiebreakAt || setTo;

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

        // Stop at minus - it separates side1 from side2
        if (nextDigit === '-') {
          i++; // Consume the minus
          break;
        }

        // For tiebreak-only formats (TB10), user MUST use minus to separate scores
        // So keep consuming all digits until we hit a minus
        if (currentSetIsTiebreakOnly) {
          side1 += nextDigit;
          i++;
          continue;
        }

        // For regular sets, enforce maxScore bounds
        const potentialValue = side1 + nextDigit;
        const val = Number.parseInt(potentialValue);

        // Check if adding this digit would create a valid score
        // For setTo=4: valid scores are 0-5, so if val>5 after adding digit, stop
        // For setTo=6: valid scores are 0-7, so if val>7 after adding digit, stop
        // For setTo=10+: need to allow 2-digit scores (10, 11, 12, etc.)
        const maxScore = setTo + 1;

        if (val > maxScore) break;

        // If we already have a digit and adding another, stop at 2 digits
        if (side1.length > 0 && side1.length >= 2) {
          break;
        }

        side1 += nextDigit;
        i++;

        // After adding, check if we should stop
        // Stop after 1 digit unless it's 1 (could be 10+) OR maxScore >= 10
        const currentVal = Number.parseInt(side1);
        if (side1.length === 1 && currentVal !== 1 && maxScore < 10) {
          // But don't stop if next character is a minus (user explicitly separating)
          if (i < segmentDigits.length && segmentDigits[i] === '-') {
            // Let the next iteration handle the minus
            continue;
          }
          break;
        }
      }

      // Parse side2
      while (i < segmentDigits.length) {
        const nextDigit = segmentDigits[i];

        // Stop at minus - it might separate side2 from next set or close tiebreak
        if (nextDigit === '-') {
          break; // Don't consume yet - might be tiebreak separator
        }

        // For tiebreak-only formats (TB10), user MUST use minus to separate scores
        // So keep consuming all digits until we hit a minus
        if (currentSetIsTiebreakOnly) {
          side2 += nextDigit;
          i++;
          continue;
        }

        // For regular sets, enforce maxScore bounds
        const potentialValue = side2 + nextDigit;
        const val = Number.parseInt(potentialValue);

        const maxScore = setTo + 1;

        // Allow up to setTo+3 temporarily for parsing, will coerce later if needed
        // This allows [3,8] and [3,9] to be parsed, then coerced to [3,6]
        if (val > setTo + 3) break;

        if (side2.length > 0 && side2.length >= 2) break;

        side2 += nextDigit;
        i++;

        const currentVal = Number.parseInt(side2);
        if (side2.length === 1 && currentVal !== 1 && maxScore < 10) break;
      }

      if (!side2) {
        // Incomplete set
        // For tiebreak-only sets, don't show incomplete score - user needs minus separator
        if (currentSetIsTiebreakOnly) {
          // Don't add anything - tiebreak-only sets require explicit minus (e.g., "9-11")
          break;
        }
        // For regular sets, show incomplete score
        if (result) result += ' ';
        result += side1;
        break;
      }

      let s1 = Number.parseInt(side1);
      let s2 = Number.parseInt(side2);

      // Coercion rules ONLY apply to regular sets, NOT tiebreak-only sets (TB10)
      // For tiebreak-only formats (SET1-S:TB10), accept scores as-is
      let wasCoerced = false;

      if (!currentSetIsTiebreakOnly) {
        // Coercion rules to match other scoring dialog behavior:
        // 1. If side > setTo+1: coerce that side DOWN to setTo
        // 2. If side = setTo+1 but other side < setTo-1: coerce the HIGH side DOWN to setTo

        // First handle > setTo+1 (coerce the excessive side DOWN)
        if (s1 > setTo + 1) {
          s1 = setTo;
          side1 = setTo.toString();
          wasCoerced = true;
        }
        if (s2 > setTo + 1) {
          s2 = setTo;
          side2 = setTo.toString();
          wasCoerced = true;
        }

        // Then handle = setTo+1 with other side < setTo-1 (coerce the HIGH side DOWN to setTo)
        if (s1 === setTo + 1 && s2 < setTo - 1) {
          s1 = setTo;
          side1 = setTo.toString();
          wasCoerced = true;
        } else if (s2 === setTo + 1 && s1 < setTo - 1) {
          s2 = setTo;
          side2 = setTo.toString();
          wasCoerced = true;
        }
      }

      // Check if this set is valid (has a winner)
      // A set must have at least 2-game margin and reach setTo
      const scoreDiff = Math.abs(s1 - s2);
      const maxScore = Math.max(s1, s2);
      const hasWinner = maxScore >= setTo && scoreDiff >= 2;

      // Check for tiebreak - but NOT if score was coerced (coerced scores don't need tiebreaks)
      // Also, only trigger tiebreak if:
      // 1. Scores are tied (6-6), OR
      // 2. Scores are 6-7/7-6 AND there are remaining digits (indicating tiebreak scores)
      const remainingDigitsExist = i < segmentDigits.length;
      const scoresTied = s1 === tiebreakAt && s2 === tiebreakAt;
      const scoresOneApart =
        (s1 === tiebreakAt + 1 && s2 === tiebreakAt) || (s2 === tiebreakAt + 1 && s1 === tiebreakAt);
      const needsTiebreak = !wasCoerced && (scoresTied || (scoresOneApart && remainingDigitsExist));

      if (needsTiebreak) {
        // Parse tiebreak scores
        // In regular tiebreaks (not NoAD), scores can be unlimited (e.g., 18-16)
        // Consume digits until we hit a minus (which closes the tiebreak and starts next set)
        while (i < segmentDigits.length) {
          const nextDigit = segmentDigits[i];

          // Stop at minus - it closes the tiebreak
          if (nextDigit === '-') {
            i++; // Consume the minus
            break; // Exit tiebreak parsing, continue to next set
          }

          tb1 += nextDigit;
          i++;
        }

        if (result) result += ' ';
        if (tb2) {
          result += `${side1}-${side2}(${tb1}-${tb2})`;
          setCount++;
        } else if (tb1) {
          result += `${side1}-${side2}(${tb1})`;
          setCount++;
        } else {
          result += `${side1}-${side2}(`;
        }
      } else {
        // Regular set (or tiebreak-only set)
        if (result) result += ' ';
        
        // For tiebreak-only formats, wrap the score in brackets [11-13]
        // This tells the factory it's a tiebreak set, not a regular set
        if (currentSetIsTiebreakOnly) {
          result += `[${side1}-${side2}]`;
        } else {
          result += `${side1}-${side2}`;
        }
        setCount++;

        // If this set doesn't have a winner, stop parsing
        // Don't continue to next iteration in the while loop
        if (!hasWinner && i < segmentDigits.length) {
          // More digits remain but current set is incomplete - stop here
          break;
        }
      }
    }
  } // end for segment

  return result;
}
