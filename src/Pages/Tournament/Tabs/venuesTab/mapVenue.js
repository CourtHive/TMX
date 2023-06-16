export function mapVenue(venue) {
  const { venueName, venueAbbreviation, addresses, venueId, courts } = venue;

  return {
    hasLocation: addresses?.[0]?.longitude,
    courtsCount: courts?.length || 0,
    scheduledMatchUpsCount: 0,
    address: addresses?.[0],
    availableTime: '',
    venueAbbreviation,
    venueName,
    venueId,
    courts,
    venue
  };
}
