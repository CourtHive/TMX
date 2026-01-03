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

    i = 0;
    const segmentDigits = segment;

    while (i < segmentDigits.length) {
      // Check format for the CURRENT set being parsed (re-check each time through the loop)
      if (setCount >= bestOf) break;
      
      const currentSetFormat = getSetFormat(setCount + 1);
      const currentTiebreakSetTo = currentSetFormat?.tiebreakSet?.tiebreakTo;
      const currentRegularSetTo = currentSetFormat?.setTo;
      const currentSetIsTiebreakOnly = !!currentTiebreakSetTo && !currentRegularSetTo;
      
      const setTo = currentTiebreakSetTo || currentRegularSetTo || 6;
      const tiebreakAt = currentSetFormat?.tiebreakAt || setTo;
      
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
        // Incomplete set - show the partial score
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
        // Strategy:
        // - Collect all digits until we hit a minus
        // - If minus is followed by a digit that could start a valid set score, close tiebreak
        // - Otherwise, treat minus as separator between tb1 and tb2
        
        // Parse tb1 (all digits until minus)
        while (i < segmentDigits.length) {
          const nextDigit = segmentDigits[i];

          // Stop at minus
          if (nextDigit === '-') {
            i++; // Consume the minus
            break;
          }

          tb1 += nextDigit;
          i++;
        }

        // After the first minus, look ahead to determine if we should parse tb2
        // or close the tiebreak and start a new set
        // Strategy: Look at the next 2-3 characters to see if they look like a set score (e.g., "67" or "63")
        // vs a single tiebreak score (e.g., "10")
        
        if (i < segmentDigits.length) {
          const remainingDigits = segmentDigits.substring(i);
          
          // Check if the next characters look like a set score pattern
          // Set scores typically have: digit, digit, (optional more digits)
          // Examples: "67" (6-7), "63" (6-3), "46" (4-6)
          // Tiebreak scores: "10", "8", "12", etc.
          
          // Extract up to 3 characters to analyze
          const lookAhead = remainingDigits.substring(0, 3);
          
          // Try to detect if this looks like two separate scores (side1 side2 for new set)
          // vs a single tiebreak score (tb2)
          let looksLikeNewSet = false;
          
          // First check: is the NEXT set going to be tiebreak-only?
          // If so, ANY digit should be treated as the start of that set
          const nextSetNumber = setCount + 2; // +1 for current set being formatted, +1 for next
          const nextSetFormat = getSetFormat(nextSetNumber);
          const nextSetIsTiebreakOnly = !!nextSetFormat?.tiebreakSet?.tiebreakTo && !nextSetFormat?.setTo;
          
          if (nextSetIsTiebreakOnly) {
            // Next set is tiebreak-only, so close this tiebreak and let the digits start the final set
            looksLikeNewSet = true;
          } else if (lookAhead.length >= 1) {
            const firstDigit = Number.parseInt(lookAhead[0]);
            
            if (!isNaN(firstDigit)) {
              // If first digit is a '1' and there's a second digit '0'-'9', it might be "10", "11", "12" etc (tiebreak score)
              // Otherwise, if first digit is 0-7, it's likely the start of a new set
              if (firstDigit === 1 && lookAhead.length >= 2) {
                const secondDigit = Number.parseInt(lookAhead[1]);
                // Check if it forms a 2-digit number like 10, 11, 12
                if (!isNaN(secondDigit)) {
                  // This looks like a 2-digit tiebreak score, NOT a new set
                  looksLikeNewSet = false;
                } else {
                  // "1" followed by non-digit, likely new set starting with 1
                  looksLikeNewSet = true;
                }
              } else if (firstDigit >= 0 && firstDigit <= setTo + 1) {
                // Single digit in game range, likely new set
                looksLikeNewSet = true;
              } else {
                // First digit > setTo+1, likely a tiebreak score
                looksLikeNewSet = false;
              }
            }
          }
          
          if (looksLikeNewSet) {
            // Close tiebreak, don't parse tb2
            // The remaining digits will be parsed as the next set in the outer loop
          } else {
            // Parse tb2
            while (i < segmentDigits.length) {
              const digit = segmentDigits[i];

              // Stop at minus - it closes the tiebreak
              if (digit === '-') {
                i++; // Consume the minus
                break;
              }

              tb2 += digit;
              i++;
            }
          }
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
