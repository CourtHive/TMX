/**
 * PDF primitive utilities
 * Ported from TMX-Suite-Legacy
 * 
 * Common formatting functions for PDF generation
 */

/**
 * Format participant name (handles both individuals and teams)
 * @param participant - Participant object
 * @returns Formatted full name
 */
export function fullName(participant: any): string {
  if (!participant) return '';
  
  // Handle individual participant
  if (participant.person) {
    const { standardFamilyName, standardGivenName } = participant.person;
    return `${standardGivenName || ''} ${standardFamilyName || ''}`.trim();
  }
  
  // Handle legacy format with first/last
  if (participant.first || participant.last) {
    return `${participant.first || ''} ${participant.last || ''}`.trim();
  }
  
  // Handle participant name directly
  if (participant.participantName) {
    return participant.participantName;
  }
  
  return '';
}

/**
 * Localize date with options
 * @param date - Date object or string
 * @param options - Intl.DateTimeFormatOptions
 * @returns Localized date string
 */
export function localizeDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (!dateObj || isNaN(dateObj.getTime())) {
    return '';
  }
  
  try {
    return new Intl.DateTimeFormat(undefined, options).format(dateObj);
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateObj.toLocaleDateString();
  }
}

/**
 * Format date as YYYY-MM-DD
 * @param date - Date object or string
 * @returns Formatted date string
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (!dateObj || isNaN(dateObj.getTime())) {
    return '';
  }
  
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Get ranking display string
 * @param participant - Participant with rankings
 * @returns Ranking string or 'NR' if not ranked
 */
export function getRankingDisplay(participant: any): string {
  if (!participant) return 'NR';
  
  // Handle factory rankings array
  if (participant.rankings && participant.rankings.length > 0) {
    const ranking = participant.rankings[0];
    return ranking.ranking?.toString() || 'NR';
  }
  
  // Handle legacy category_ranking
  if (participant.category_ranking) {
    return participant.category_ranking.toString();
  }
  
  return 'NR';
}

/**
 * Get seeding display string
 * @param participant - Participant with seeding
 * @returns Seeding string or empty if unseeded
 */
export function getSeedingDisplay(participant: any): string {
  if (!participant) return '';
  
  // Handle factory seedings array
  if (participant.seedings && participant.seedings.length > 0) {
    const seeding = participant.seedings[0];
    return seeding.seedNumber?.toString() || '';
  }
  
  // Handle legacy seed
  if (participant.seed) {
    return participant.seed.toString();
  }
  
  return '';
}

/**
 * Get entry type display string (WC, LL, A, etc.)
 * @param participant - Participant with entries
 * @returns Entry type string or empty
 */
export function getEntryDisplay(participant: any): string {
  if (!participant) return '';
  
  // Handle factory entries array
  if (participant.entries && participant.entries.length > 0) {
    const entry = participant.entries[0];
    return entry.entryStage || entry.entryStatus || '';
  }
  
  // Handle legacy entry
  if (participant.entry) {
    return participant.entry;
  }
  
  return '';
}

/**
 * Format player name with ranking
 * Example: "John Doe [42]"
 * @param participant - Participant object
 * @returns Formatted name with ranking
 */
export function nameWithRanking(participant: any): string {
  const name = fullName(participant);
  const ranking = getRankingDisplay(participant);
  
  if (!name) return '';
  if (ranking === 'NR' || !ranking) return name;
  
  return `${name} [${ranking}]`;
}

/**
 * Format player name with entry type
 * Example: "John Doe [WC]"
 * @param participant - Participant object
 * @returns Formatted name with entry type
 */
export function nameWithEntry(participant: any): string {
  const name = fullName(participant);
  const entry = getEntryDisplay(participant);
  
  if (!name) return '';
  if (!entry) return name;
  
  return `${name} [${entry}]`;
}
