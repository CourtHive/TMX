/**
 * Pure-logic helpers behind `openManagePracticeRegistrationsModal`. Kept
 * separate from the DOM-building module so they can be unit-tested without
 * mounting the modal.
 */

import { tournamentEngine } from 'services/factory/engine';

export type BookingResolution = {
  tournamentId: string;
  venueName?: string;
  courtName?: string;
  booking: any;
  nameById: Map<string, string>;
  participants: { participantId: string; participantName: string }[];
};

/**
 * Reads the tournament record from `tournamentEngine` and resolves the
 * specific PRACTICE booking the modal is targeting. Returns `undefined`
 * when any of the lookup steps fail — caller renders an
 * "booking-not-found" message in that case.
 */
export function resolveBookingForModal({
  courtId,
  date,
  bookingId,
}: {
  courtId: string;
  date: string;
  bookingId: string;
}): BookingResolution | undefined {
  const { tournamentRecord } = tournamentEngine.getTournament() || {};
  if (!tournamentRecord) return undefined;
  return resolveFromRecord({ tournamentRecord, courtId, date, bookingId });
}

/**
 * Same as `resolveBookingForModal` but takes the record as an argument —
 * the test-friendly variant. Production code uses the engine-backed wrapper.
 */
export function resolveFromRecord({
  tournamentRecord,
  courtId,
  date,
  bookingId,
}: {
  tournamentRecord: any;
  courtId: string;
  date: string;
  bookingId: string;
}): BookingResolution | undefined {
  if (!tournamentRecord) return undefined;

  const lookup = findCourtAndBooking({ tournamentRecord, courtId, date, bookingId });
  if (!lookup) return undefined;

  const { booking, court, venue } = lookup;
  const nameById = buildParticipantNameMap(tournamentRecord);
  const participants = (tournamentRecord.participants ?? [])
    .filter((p: any) => p?.participantId && p?.participantName)
    .map((p: any) => ({ participantId: p.participantId, participantName: p.participantName }));

  return {
    tournamentId: tournamentRecord.tournamentId,
    venueName: venue?.venueName,
    courtName: court?.courtName ?? court?.courtId,
    booking,
    nameById,
    participants,
  };
}

function findCourtAndBooking({
  tournamentRecord,
  courtId,
  date,
  bookingId,
}: {
  tournamentRecord: any;
  courtId: string;
  date: string;
  bookingId: string;
}): { booking: any; court: any; venue: any } | undefined {
  for (const venue of tournamentRecord.venues ?? []) {
    for (const court of venue.courts ?? []) {
      if (court.courtId !== courtId) continue;
      const booking = findBookingOnCourt({ court, date, bookingId });
      if (booking) return { booking, court, venue };
    }
  }
  return undefined;
}

function findBookingOnCourt({
  court,
  date,
  bookingId,
}: {
  court: any;
  date: string;
  bookingId: string;
}): any {
  for (const availability of court.dateAvailability ?? []) {
    if (availability.date !== date) continue;
    for (const booking of availability.bookings ?? []) {
      if (booking.bookingType !== 'PRACTICE') continue;
      if (booking.bookingId === bookingId) return booking;
      const derivedId = `${court.courtId}-${date}-${booking.startTime ?? ''}`;
      if (derivedId === bookingId) return booking;
    }
  }
  return undefined;
}

export function buildParticipantNameMap(tournamentRecord: any): Map<string, string> {
  const map = new Map<string, string>();
  for (const participant of tournamentRecord?.participants ?? []) {
    if (participant?.participantId && participant.participantName) {
      map.set(participant.participantId, participant.participantName);
    }
  }
  return map;
}

export function formatBookingHeader(resolution: BookingResolution): string {
  const { booking, courtName, venueName } = resolution;
  const bookingType = booking.bookingType ?? 'PRACTICE';
  const start = booking.startTime ?? '';
  const end = booking.endTime ?? '';
  const window = start && end ? `${start}–${end}` : '';
  const windowSuffix = window ? ` ${window}` : '';
  const courtLabel = [venueName, courtName].filter(Boolean).join(' / ');
  return [`${bookingType}${windowSuffix}`, courtLabel].filter(Boolean).join(' • ');
}

export function formatRegistrationLabel(registration: any, nameById: Map<string, string>): string {
  const name = nameById.get(registration.participantId) ?? registration.participantId;
  const start = registration.startTime ?? '';
  const end = registration.endTime ?? '';
  const window = start && end ? ` (${start}–${end})` : '';
  return `${name}${window}`;
}

/**
 * For Phase 1, every tournament participant is selectable. Future phases
 * may restrict by event-membership or other policy — that filter lives
 * here so the modal stays unchanged.
 */
export function filterParticipantsForRegistration(
  resolution: BookingResolution,
): { participantId: string; participantName: string }[] {
  return resolution.participants;
}
