import type { AvailabilityEngine } from 'tods-competition-factory';

function findResourceIdentifier(resources: any[] | undefined, name: string): string | undefined {
  if (!Array.isArray(resources)) return undefined;
  const resource = resources.find((r) => r?.name === name);
  return resource?.identifier;
}

type CourtSchedulingSummary = ReturnType<AvailabilityEngine['getCourtSchedulingSummary']>;

/**
 * A court's time, in minutes, as the courts table shows it.
 *
 * - scheduled: the matchUps on the court's grid (`gridMinutes`) plus any timed SCHEDULED or LOCKED bookings.
 * - practice: timed PRACTICE bookings; blocked: every other timed booking (maintenance, drying, closed, blocked).
 * - unscheduled: what is left of the court's available time once the grid matchUps are taken out.
 *
 * Grid (row) bookings carry no times; the engine does not read them and neither does this.
 */
export function courtTimes(summary: CourtSchedulingSummary, gridMinutes = 0) {
  const practiceMinutes = summary.minutesByType.PRACTICE ?? 0;
  return {
    scheduledMinutes: summary.scheduledMinutes + gridMinutes,
    practiceMinutes,
    blockedMinutes: summary.blockedMinutes - practiceMinutes,
    unscheduledMinutes: Math.max(0, summary.availableMinutes - gridMinutes),
  };
}

// `scheduledByVenue` is scheduledMatchUpsByVenue's count of the matchUps placed on each venue;
// `gridMinutes` is gridMinutesByCourt's minutes of play on each court's grid.
export function mapVenue(
  venue: any,
  engine?: AvailabilityEngine,
  scheduledByVenue?: Map<string, number>,
  gridMinutes?: Map<string, number>,
): any {
  const { venueName, venueAbbreviation, addresses, venueId, courts, onlineResources } = venue;

  const mappedCourts = courts?.map((court: any) => {
    if (!engine) return court;

    const courtRef = {
      tournamentId: engine.getConfig().tournamentId,
      venueId,
      courtId: court.courtId,
    };
    const summary = engine.getCourtSchedulingSummary(courtRef);
    return { ...court, ...courtTimes(summary, gridMinutes?.get(court.courtId)) };
  });

  return {
    hasLocation: addresses?.[0]?.longitude,
    courtsCount: courts?.length || 0,
    scheduledMatchUpsCount: scheduledByVenue?.get(venueId) ?? 0,
    address: addresses?.[0],
    availableTime: '',
    venueAbbreviation,
    venueName,
    venueId,
    venueImageURL: findResourceIdentifier(onlineResources, 'venueImage'),
    venueWebsiteURL: findResourceIdentifier(onlineResources, 'venueWebsite'),
    courts: mappedCourts,
    venue,
  };
}
