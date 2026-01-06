/**
 * Shared utilities for formatting scores for display in scoring modals
 */

/**
 * Format existing score object into string for input field
 */
export function formatExistingScore(scoreObject: any, matchUpStatus?: string): string {
  if (!scoreObject) return '';
  
  // Build score string from sets
  const sets = scoreObject.sets || [];
  const scoreString = sets
    .map((set: any) => {
      let setStr = `${set.side1Score || 0}-${set.side2Score || 0}`;
      
      // Add tiebreak score if present
      if (set.side1TiebreakScore !== undefined || set.side2TiebreakScore !== undefined) {
        const tbScore = set.winningSide === 1 
          ? set.side2TiebreakScore 
          : set.side1TiebreakScore;
        setStr += `(${tbScore})`;
      }
      
      return setStr;
    })
    .join(' ');
  
  // Append matchUpStatus abbreviation if present (but not for TO_BE_PLAYED or COMPLETED)
  if (matchUpStatus && matchUpStatus !== 'COMPLETED' && matchUpStatus !== 'TO_BE_PLAYED') {
    const statusAbbrev = getStatusAbbreviation(matchUpStatus);
    if (statusAbbrev) {
      return scoreString ? `${scoreString} ${statusAbbrev}` : statusAbbrev;
    }
  }
  
  return scoreString;
}

/**
 * Get short abbreviation for matchUpStatus
 * Returns empty string for unknown or unhandled statuses
 */
export function getStatusAbbreviation(status: string): string {
  const abbrevMap: Record<string, string> = {
    'RETIRED': 'ret',
    'WALKOVER': 'wo',
    'DEFAULTED': 'def',
    'SUSPENDED': 'susp',
    'CANCELLED': 'canc',
    'INCOMPLETE': 'inc',
    'DEAD_RUBBER': 'dr',
    'IN_PROGRESS': 'in',
    'AWAITING_RESULT': 'await',
  };
  return abbrevMap[status] || '';
}
