import type { AvailabilityEngine } from 'tods-competition-factory';

function findResourceIdentifier(resources: any[] | undefined, name: string): string | undefined {
  if (!Array.isArray(resources)) return undefined;
  const resource = resources.find((r) => r?.name === name);
  return resource?.identifier;
}

export function mapVenue(venue: any, engine?: AvailabilityEngine): any {
  const { venueName, venueAbbreviation, addresses, venueId, courts, onlineResources } = venue;

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
    venueImageURL: findResourceIdentifier(onlineResources, 'venueImage'),
    venueWebsiteURL: findResourceIdentifier(onlineResources, 'venueWebsite'),
    courts: mappedCourts,
    venue,
  };
}
