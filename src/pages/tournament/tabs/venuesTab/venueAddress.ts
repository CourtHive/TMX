/**
 * A venue's address as Add / Edit venue write it, time zone included.
 *
 * CA, 2026-11-18: an added venue is in the tournament's time zone by default, and the zone is editable. Adding a
 * venue by hand never set one, so a zone-less tournament could only learn its zone from a registry address.
 */
import { isValidTimeZone } from 'functions/getSupportedTimeZones';
import type { VenueFrame } from 'functions/venueTimeFrame';

const ADDRESS_FIELDS = ['addressLine1', 'city', 'state', 'postalCode', 'countryCode', 'timeZone'] as const;

/**
 * The zone a new venue starts in: the tournament's, or the one its other venues agree on. Never the browser's, which
 * the frame only stands in with: stamping it on a venue would make a guess look like a setting.
 */
export function defaultVenueTimeZone(frame: VenueFrame): string {
  return frame.source === 'tournament' || frame.source === 'venue' ? frame.timeZone : '';
}

/** The zone typed into the field: empty clears it; anything that is not a zone keeps `previous`, as Edit dates does. */
export function readVenueTimeZone(raw: string | undefined, previous: string): string {
  const value = (raw ?? '').trim();
  return value === '' || isValidTimeZone(value) ? value : previous;
}

/** The address object for the values given, or undefined when none is filled in. */
export function buildVenueAddress(values: Partial<Record<(typeof ADDRESS_FIELDS)[number], string>>) {
  const address: Record<string, string> = {};
  for (const field of ADDRESS_FIELDS) if (values[field]) address[field] = values[field];
  return Object.keys(address).length ? address : undefined;
}
