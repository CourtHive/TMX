/**
 * Pure helpers for the ratings progression table.
 */

/** The matchUps a dynamic rating reads: those with a winner, and completed draws (rated 0.5 each by the factory). */
export function ratedMatchUpIds(matchUps: any[]): string[] {
  return matchUps
    .filter((matchUp: any) => matchUp.winningSide || matchUp.matchUpStatus === 'COMPLETED')
    .map((matchUp: any) => matchUp.matchUpId);
}

/** The header tooltip naming the ratings policies that produced the dynamic values, or undefined when none is known. */
export function ratingsPolicyCaption(ratingsPolicyNames?: string[]): string | undefined {
  return ratingsPolicyNames?.length ? ratingsPolicyNames.join(', ') : undefined;
}
