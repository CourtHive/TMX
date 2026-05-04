import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  getTournamentMock,
  getVenuesAndCourtsMock,
  temporalInit,
  temporalGetDays,
  temporalGetCourtAvailability,
} = vi.hoisted(() => ({
  getTournamentMock: vi.fn(),
  getVenuesAndCourtsMock: vi.fn(),
  temporalInit: vi.fn(),
  temporalGetDays: vi.fn(),
  temporalGetCourtAvailability: vi.fn(),
}));

vi.mock('tods-competition-factory', () => {
  class MockTemporalEngine {
    init = temporalInit;
    getTournamentDays = temporalGetDays;
    getCourtAvailability = temporalGetCourtAvailability;
  }
  return {
    tournamentEngine: { getTournament: (...args: any[]) => getTournamentMock(...args) },
    competitionEngine: { getVenuesAndCourts: (...args: any[]) => getVenuesAndCourtsMock(...args) },
    TemporalEngine: MockTemporalEngine,
  };
});

const DAY_1 = '2026-06-15';
const DAY_2 = '2026-06-16';

import { getTournamentCapacity } from './getTournamentCapacity';

beforeEach(() => {
  getTournamentMock.mockReset();
  getVenuesAndCourtsMock.mockReset();
  temporalInit.mockReset();
  temporalGetDays.mockReset();
  temporalGetCourtAvailability.mockReset();
});

describe('getTournamentCapacity', () => {
  it('returns the empty shape when there is no tournament', () => {
    getTournamentMock.mockReturnValue(undefined);
    const cap = getTournamentCapacity();
    expect(cap.courtCount).toEqual(0);
    expect(cap.hasVenues).toBe(false);
    expect(cap.hasTemporalInfo).toBe(false);
  });

  it('counts courts across venues without temporal info when dates are missing', () => {
    getTournamentMock.mockReturnValue({ tournamentRecord: { tournamentId: 't1' } });
    getVenuesAndCourtsMock.mockReturnValue({
      venues: [
        { venueId: 'v1', tournamentId: 't1', courts: [{ courtId: 'c1' }, { courtId: 'c2' }] },
        { venueId: 'v2', tournamentId: 't1', courts: [{ courtId: 'c3' }] },
      ],
    });
    const cap = getTournamentCapacity();
    expect(cap.courtCount).toEqual(3);
    expect(cap.hasVenues).toBe(true);
    expect(cap.hasTemporalInfo).toBe(false);
    expect(cap.effectiveCourtCount).toBeUndefined();
  });

  it('computes an effective per-day average when temporal info is available', () => {
    getTournamentMock.mockReturnValue({
      tournamentRecord: { tournamentId: 't1', startDate: DAY_1, endDate: DAY_2 },
    });
    getVenuesAndCourtsMock.mockReturnValue({
      venues: [{ venueId: 'v1', tournamentId: 't1', courts: [{ courtId: 'c1' }, { courtId: 'c2' }] }],
    });
    temporalGetDays.mockReturnValue([DAY_1, DAY_2]);
    // Day 1: both courts available; Day 2: only c1 available
    temporalGetCourtAvailability.mockImplementation((courtRef: any, day: string) => {
      if (day === DAY_1) return { startTime: '09:00', endTime: '17:00' };
      if (day === DAY_2 && courtRef.courtId === 'c1') return { startTime: '09:00', endTime: '17:00' };
      return { startTime: '09:00', endTime: '09:00' };
    });
    const cap = getTournamentCapacity();
    expect(cap.courtCount).toEqual(2);
    expect(cap.effectiveCourtCount).toEqual(1.5); // (2 + 1) / 2
    expect(cap.hasTemporalInfo).toBe(true);
    expect(cap.dayCount).toEqual(2);
  });

  it('reports zero courts when no venues', () => {
    getTournamentMock.mockReturnValue({ tournamentRecord: { tournamentId: 't1' } });
    getVenuesAndCourtsMock.mockReturnValue({ venues: [] });
    const cap = getTournamentCapacity();
    expect(cap.courtCount).toEqual(0);
    expect(cap.hasVenues).toBe(false);
  });
});
