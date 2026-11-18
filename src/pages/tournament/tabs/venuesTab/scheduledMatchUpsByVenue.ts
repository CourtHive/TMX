/**
 * How many matchUps are scheduled on each venue: placed on the venue (`schedule.venueId`) or on one of its courts
 * (`schedule.courtId`), whichever the matchUp carries. A matchUp that only has a date is not on any venue.
 */
export function scheduledMatchUpsByVenue(matchUps: any[], venues: any[]): Map<string, number> {
  const venueByCourt = new Map<string, string>();
  for (const venue of venues ?? []) {
    for (const court of venue?.courts ?? []) if (court?.courtId) venueByCourt.set(court.courtId, venue.venueId);
  }

  const counts = new Map<string, number>();
  for (const matchUp of matchUps ?? []) {
    const schedule = matchUp?.schedule;
    const venueId = schedule?.venueId ?? (schedule?.courtId && venueByCourt.get(schedule.courtId));
    if (venueId) counts.set(venueId, (counts.get(venueId) ?? 0) + 1);
  }
  return counts;
}
