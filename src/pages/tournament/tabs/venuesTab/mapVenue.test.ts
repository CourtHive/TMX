import { makeAverageMinutesResolver } from '../scheduleViews/scheduleTimingResolver';
import { AvailabilityEngine, mocksEngine } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';
import { gridMinutesByCourt } from './gridMinutesByCourt';
import { describe, expect, it } from 'vitest';
import { courtTimes, mapVenue } from './mapVenue';

// A court open 08:00-20:00 for two days: 1440 minutes, as getCourtSchedulingSummary reports it.
const summary = (overrides: any = {}) => ({
  scheduledMinutes: 0,
  availableMinutes: 1440,
  blockedMinutes: 0,
  minutesByType: { AVAILABLE: 1440 },
  ...overrides,
});

describe('courtTimes', () => {
  it('counts the matchUps on the grid as scheduled, and takes them out of unscheduled', () => {
    expect(courtTimes(summary(), 360)).toEqual({
      scheduledMinutes: 360,
      unscheduledMinutes: 1080,
      practiceMinutes: 0,
      blockedMinutes: 0,
    });
  });

  it('splits practice out of the engine’s blocked total', () => {
    const withBookings = summary({
      availableMinutes: 1260,
      blockedMinutes: 180,
      minutesByType: { AVAILABLE: 1260, PRACTICE: 120, MAINTENANCE: 60 },
    });
    expect(courtTimes(withBookings)).toEqual({
      scheduledMinutes: 0,
      unscheduledMinutes: 1260,
      practiceMinutes: 120,
      blockedMinutes: 60,
    });
  });

  it('adds timed SCHEDULED bookings to the grid matchUps', () => {
    const booked = summary({
      scheduledMinutes: 180,
      availableMinutes: 1260,
      minutesByType: { AVAILABLE: 1260, SCHEDULED: 180 },
    });
    expect(courtTimes(booked, 90).scheduledMinutes).toBe(270);
  });

  it('never reports negative unscheduled time when the grid holds more than the court is open', () => {
    expect(courtTimes(summary({ availableMinutes: 60 }), 180).unscheduledMinutes).toBe(0);
  });
});

describe('mapVenue court times, end to end', () => {
  it('counts grid matchUps, not suggestions, and splits a timed practice booking from blocked time', () => {
    const startDate = '2026-12-05';
    mocksEngine.generateTournamentRecord({
      venueProfiles: [{ courtsCount: 3, startTime: '08:00', endTime: '20:00' }],
      drawProfiles: [{ drawSize: 8, matchUpFormat: 'SET3-S:6/TB7' }],
      startDate,
      endDate: startDate,
      setState: true,
    });
    const { venues }: any = tournamentEngine.getVenuesAndCourts();
    const venue = venues[0];
    const [c1, c2, c3] = venue.courts.map((court: any) => court.courtId);
    const { matchUps }: any = tournamentEngine.allTournamentMatchUps({ inContext: true });
    const place = (matchUp: any, courtId: string, courtOrder?: number) =>
      tournamentEngine.addMatchUpScheduleItems({
        schedule: { venueId: venue.venueId, courtId, scheduledDate: startDate, ...(courtOrder && { courtOrder }) },
        matchUpId: matchUp.matchUpId,
        drawId: matchUp.drawId,
      });
    place(matchUps[0], c1, 1);
    place(matchUps[1], c1, 2);
    place(matchUps[2], c2); // a suggestion: a court, no grid row
    tournamentEngine.modifyCourtAvailability({
      dateAvailability: [
        {
          date: startDate,
          startTime: '08:00',
          endTime: '20:00',
          bookings: [{ bookingType: 'PRACTICE', startTime: '08:00', endTime: '10:00' }],
        },
      ],
      courtId: c3,
      force: true,
    });

    const record = tournamentEngine.getTournament().tournamentRecord;
    const engine = new AvailabilityEngine();
    engine.init(record);
    const { matchUps: inContext }: any = tournamentEngine.allTournamentMatchUps({ inContext: true });
    const averageMinutes = makeAverageMinutesResolver();
    const average = averageMinutes(inContext[0]) ?? 0;
    const gridMinutes = gridMinutesByCourt(inContext, averageMinutes);
    const { venues: updated }: any = tournamentEngine.getVenuesAndCourts();
    const courts = mapVenue(updated[0], engine, undefined, gridMinutes).courts;
    const byId = Object.fromEntries(courts.map((court: any) => [court.courtId, court]));

    expect(average).toBeGreaterThan(0);
    expect(byId[c1]).toMatchObject({ scheduledMinutes: 2 * average, unscheduledMinutes: 720 - 2 * average });
    expect(byId[c2]).toMatchObject({ scheduledMinutes: 0, unscheduledMinutes: 720 });
    expect(byId[c3]).toMatchObject({
      scheduledMinutes: 0,
      practiceMinutes: 120,
      blockedMinutes: 0,
      unscheduledMinutes: 600,
    });
  });
});
