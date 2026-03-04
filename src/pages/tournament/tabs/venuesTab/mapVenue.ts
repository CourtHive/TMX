import type { TemporalEngine } from 'tods-competition-factory';

export function mapVenue(venue: any, engine?: TemporalEngine): any {
  const { venueName, venueAbbreviation, addresses, venueId, courts } = venue;

  const mappedCourts = courts?.map((court: any) => {
    if (!engine) return court;

    const courtRef = {
      tournamentId: engine.getConfig().tournamentId,
      venueId,
      courtId: court.courtId,
    };
    const summary = engine.getCourtSchedulingSummary(courtRef);
    return {
      ...court,
      scheduledMinutes: summary.scheduledMinutes,
      unscheduledMinutes: summary.availableMinutes,
    };
  });

  return {
    hasLocation: addresses?.[0]?.longitude,
    courtsCount: courts?.length || 0,
    scheduledMatchUpsCount: 0,
    address: addresses?.[0],
    availableTime: '',
    venueAbbreviation,
    venueName,
    venueId,
    courts: mappedCourts,
    venue,
  };
}
