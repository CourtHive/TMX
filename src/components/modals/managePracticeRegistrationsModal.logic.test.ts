import { describe, expect, it } from 'vitest';

import {
  buildParticipantNameMap,
  filterParticipantsForRegistration,
  formatBookingHeader,
  formatRegistrationLabel,
  resolveFromRecord,
} from './managePracticeRegistrationsModal.logic';

const DATE = '2026-06-15';
const COURT_ID = 'court-1';
const BOOKING_ID = 'booking-1';
const ALICE = 'Alice Smith';

function buildRecord(
  bookings: any[] = [
    {
      bookingId: BOOKING_ID,
      bookingType: 'PRACTICE',
      startTime: '14:00',
      endTime: '16:00',
      registrations: [],
    },
  ],
): any {
  return {
    tournamentId: 't1',
    participants: [
      { participantId: 'p1', participantName: ALICE },
      { participantId: 'p2', participantName: 'Bob Jones' },
    ],
    venues: [
      {
        venueId: 'v1',
        venueName: 'Main Club',
        courts: [
          {
            courtId: COURT_ID,
            courtName: 'Court 1',
            dateAvailability: [{ date: DATE, bookings }],
          },
        ],
      },
    ],
  };
}

describe('resolveFromRecord', () => {
  it('resolves a PRACTICE booking by explicit bookingId', () => {
    const tournamentRecord = buildRecord();
    const resolution = resolveFromRecord({ tournamentRecord, courtId: COURT_ID, date: DATE, bookingId: BOOKING_ID });
    expect(resolution).toBeDefined();
    expect(resolution!.booking.bookingType).toBe('PRACTICE');
    expect(resolution!.courtName).toBe('Court 1');
    expect(resolution!.venueName).toBe('Main Club');
  });

  it('resolves by deterministic id when bookingId is unset (legacy backfill)', () => {
    const tournamentRecord = buildRecord([
      { bookingType: 'PRACTICE', startTime: '14:00', endTime: '16:00', registrations: [] },
    ]);
    const derived = `${COURT_ID}-${DATE}-14:00`;
    const resolution = resolveFromRecord({ tournamentRecord, courtId: COURT_ID, date: DATE, bookingId: derived });
    expect(resolution).toBeDefined();
    expect(resolution!.booking.bookingType).toBe('PRACTICE');
  });

  it('returns undefined when court does not exist', () => {
    const tournamentRecord = buildRecord();
    const resolution = resolveFromRecord({
      tournamentRecord,
      courtId: 'court-missing',
      date: DATE,
      bookingId: BOOKING_ID,
    });
    expect(resolution).toBeUndefined();
  });

  it('returns undefined when bookingId does not match any PRACTICE booking', () => {
    const tournamentRecord = buildRecord();
    const resolution = resolveFromRecord({
      tournamentRecord,
      courtId: COURT_ID,
      date: DATE,
      bookingId: 'booking-missing',
    });
    expect(resolution).toBeUndefined();
  });

  it('ignores non-PRACTICE bookings of the same id', () => {
    const tournamentRecord = buildRecord([
      { bookingId: BOOKING_ID, bookingType: 'MAINTENANCE', startTime: '14:00', endTime: '16:00' },
    ]);
    const resolution = resolveFromRecord({ tournamentRecord, courtId: COURT_ID, date: DATE, bookingId: BOOKING_ID });
    expect(resolution).toBeUndefined();
  });

  it('returns undefined for a missing tournamentRecord', () => {
    const resolution = resolveFromRecord({
      tournamentRecord: undefined,
      courtId: COURT_ID,
      date: DATE,
      bookingId: BOOKING_ID,
    });
    expect(resolution).toBeUndefined();
  });
});

describe('buildParticipantNameMap', () => {
  it('maps participantId to participantName', () => {
    const map = buildParticipantNameMap(buildRecord());
    expect(map.get('p1')).toBe(ALICE);
    expect(map.get('p2')).toBe('Bob Jones');
  });

  it('skips participants missing id or name', () => {
    const record = {
      participants: [
        { participantId: 'p1', participantName: 'Alice' },
        { participantId: 'p2' },
        { participantName: 'No-ID' },
        null,
      ],
    };
    const map = buildParticipantNameMap(record);
    expect(map.size).toBe(1);
  });
});

describe('formatBookingHeader', () => {
  it('renders bookingType, time window, and venue/court labels separated by a bullet', () => {
    const resolution = resolveFromRecord({
      tournamentRecord: buildRecord(),
      courtId: COURT_ID,
      date: DATE,
      bookingId: BOOKING_ID,
    })!;
    const header = formatBookingHeader(resolution);
    expect(header).toContain('PRACTICE');
    expect(header).toContain('14:00–16:00');
    expect(header).toContain('Main Club / Court 1');
  });

  it('omits the time window when startTime / endTime are absent', () => {
    const resolution = resolveFromRecord({
      tournamentRecord: buildRecord([{ bookingId: BOOKING_ID, bookingType: 'PRACTICE' }]),
      courtId: COURT_ID,
      date: DATE,
      bookingId: BOOKING_ID,
    })!;
    const header = formatBookingHeader(resolution);
    expect(header).not.toContain('–');
    expect(header).toContain('PRACTICE');
  });
});

describe('formatRegistrationLabel', () => {
  it('renders name and sub-window', () => {
    const nameById = new Map([['p1', ALICE]]);
    const label = formatRegistrationLabel(
      { participantId: 'p1', startTime: '14:00', endTime: '14:30' },
      nameById,
    );
    expect(label).toBe('Alice Smith (14:00–14:30)');
  });

  it('falls back to participantId when name is unknown', () => {
    const label = formatRegistrationLabel(
      { participantId: 'p-unknown', startTime: '14:00', endTime: '14:30' },
      new Map(),
    );
    expect(label).toBe('p-unknown (14:00–14:30)');
  });
});

describe('filterParticipantsForRegistration', () => {
  it('returns every tournament participant for Phase 1', () => {
    const resolution = resolveFromRecord({
      tournamentRecord: buildRecord(),
      courtId: COURT_ID,
      date: DATE,
      bookingId: BOOKING_ID,
    })!;
    const list = filterParticipantsForRegistration(resolution);
    expect(list.length).toBe(2);
    expect(list[0].participantName).toBe(ALICE);
  });
});
