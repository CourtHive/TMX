import { describe, expect, it } from 'vitest';

import { buildParticipantNameMap, getActiveRegistrationNamesByCourtId } from './practiceRegistrationStrip';

const DATE = '2026-06-15';
const CONFIRMED = 'CONFIRMED';
const ALICE = 'Alice Smith';

function buildRecord({ bookings, registrations }: { bookings?: any[]; registrations?: any[] } = {}) {
  return {
    tournamentId: 't1',
    participants: [
      { participantId: 'p1', participantName: ALICE },
      { participantId: 'p2', participantName: 'Bob Jones' },
      { participantId: 'p3', participantName: 'Carla Ortiz' },
    ],
    venues: [
      {
        venueId: 'v1',
        courts: [
          {
            courtId: 'court-1',
            dateAvailability: [
              {
                date: DATE,
                startTime: '08:00',
                endTime: '20:00',
                bookings: bookings ?? [
                  {
                    bookingId: 'booking-1',
                    bookingType: 'PRACTICE',
                    startTime: '14:00',
                    endTime: '16:00',
                    registrations: registrations ?? [],
                  },
                ],
              },
            ],
          },
          {
            courtId: 'court-2',
            dateAvailability: [
              {
                date: DATE,
                startTime: '08:00',
                endTime: '20:00',
                bookings: [],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe('getActiveRegistrationNamesByCourtId', () => {
  it('returns participant names for registrations whose sub-window contains the clock time', () => {
    const tournamentRecord = buildRecord({
      registrations: [
        {
          registrationId: 'r1',
          participantId: 'p1',
          startTime: '14:00',
          endTime: '14:30',
          status: CONFIRMED,
        },
      ],
    });
    const result = getActiveRegistrationNamesByCourtId({ tournamentRecord, date: DATE, currentHM: '14:15' });
    expect(result).toEqual({ 'court-1': [ALICE] });
  });

  it('excludes registrations whose sub-window has not started', () => {
    const tournamentRecord = buildRecord({
      registrations: [
        { registrationId: 'r1', participantId: 'p1', startTime: '14:30', endTime: '15:00', status: CONFIRMED },
      ],
    });
    const result = getActiveRegistrationNamesByCourtId({ tournamentRecord, date: DATE, currentHM: '14:00' });
    expect(result).toEqual({});
  });

  it('excludes registrations whose sub-window has ended', () => {
    const tournamentRecord = buildRecord({
      registrations: [
        { registrationId: 'r1', participantId: 'p1', startTime: '14:00', endTime: '14:30', status: CONFIRMED },
      ],
    });
    const result = getActiveRegistrationNamesByCourtId({ tournamentRecord, date: DATE, currentHM: '14:30' });
    expect(result).toEqual({});
  });

  it('excludes cancelled registrations even when sub-window contains the clock time', () => {
    const tournamentRecord = buildRecord({
      registrations: [
        { registrationId: 'r1', participantId: 'p1', startTime: '14:00', endTime: '14:30', status: 'CANCELLED' },
      ],
    });
    const result = getActiveRegistrationNamesByCourtId({ tournamentRecord, date: DATE, currentHM: '14:15' });
    expect(result).toEqual({});
  });

  it('groups multiple concurrent registrations under their courtId', () => {
    const tournamentRecord = buildRecord({
      registrations: [
        { registrationId: 'r1', participantId: 'p1', startTime: '14:00', endTime: '14:30', status: CONFIRMED },
        { registrationId: 'r2', participantId: 'p2', startTime: '14:00', endTime: '14:30', status: CONFIRMED },
        { registrationId: 'r3', participantId: 'p3', startTime: '15:00', endTime: '15:30', status: CONFIRMED },
      ],
    });
    const result = getActiveRegistrationNamesByCourtId({ tournamentRecord, date: DATE, currentHM: '14:15' });
    expect(result).toEqual({ 'court-1': [ALICE, 'Bob Jones'] });
  });

  it('returns an empty object when no PRACTICE bookings exist', () => {
    const tournamentRecord = buildRecord({ bookings: [] });
    const result = getActiveRegistrationNamesByCourtId({ tournamentRecord, date: DATE, currentHM: '14:15' });
    expect(result).toEqual({});
  });

  it('returns an empty object when tournamentRecord is missing', () => {
    const result = getActiveRegistrationNamesByCourtId({
      tournamentRecord: undefined,
      date: DATE,
      currentHM: '14:15',
    });
    expect(result).toEqual({});
  });

  it('skips registrations whose participant is not in the tournament', () => {
    const tournamentRecord = buildRecord({
      registrations: [
        { registrationId: 'r1', participantId: 'p-unknown', startTime: '14:00', endTime: '14:30', status: CONFIRMED },
      ],
    });
    const result = getActiveRegistrationNamesByCourtId({ tournamentRecord, date: DATE, currentHM: '14:15' });
    expect(result).toEqual({});
  });
});

describe('buildParticipantNameMap', () => {
  it('maps participantId → participantName for participants with both fields', () => {
    const tournamentRecord = buildRecord();
    const map = buildParticipantNameMap(tournamentRecord);
    expect(map.get('p1')).toBe(ALICE);
    expect(map.get('p2')).toBe('Bob Jones');
    expect(map.size).toBe(3);
  });

  it('returns an empty map for an absent participants array', () => {
    const map = buildParticipantNameMap({});
    expect(map.size).toBe(0);
  });
});
