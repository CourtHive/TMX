import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the engine BEFORE importing the cache so the module captures the
// mock reference, not the real factory. Each test resets the call counts
// to make per-test assertions precise.
const allTournamentMatchUpsMock = vi.fn();
const competitionScheduleMatchUpsMock = vi.fn();
const getCompetitionDateRangeMock = vi.fn();
const getTournamentInfoMock = vi.fn();

vi.mock('services/factory/engine', () => ({
  competitionEngine: {
    allTournamentMatchUps: (...args: any[]) => allTournamentMatchUpsMock(...args),
    competitionScheduleMatchUps: (...args: any[]) => competitionScheduleMatchUpsMock(...args),
    getCompetitionDateRange: (...args: any[]) => getCompetitionDateRangeMock(...args),
    getTournamentInfo: (...args: any[]) => getTournamentInfoMock(...args),
  },
  tournamentEngine: {},
}));

import {
  getCachedAllMatchUps,
  getCachedScheduleMatchUps,
  getCachedCompetitionDateRange,
  getCachedTournamentInfo,
  invalidateMatchUpCaches,
  invalidateAllScheduleCaches,
  syncTournamentContext,
} from './schedule2DataCache';

const DATE_A = '2026-06-13';
const DATE_B = '2026-06-14';

describe('schedule2DataCache', () => {
  beforeEach(() => {
    allTournamentMatchUpsMock.mockReset().mockReturnValue({ matchUps: [] });
    competitionScheduleMatchUpsMock.mockReset().mockReturnValue({ courtsData: [], rows: [] });
    getCompetitionDateRangeMock.mockReset().mockReturnValue({ startDate: DATE_A, endDate: '2026-06-15' });
    getTournamentInfoMock.mockReset().mockReturnValue({ tournamentInfo: { tournamentId: 't1' } });
    invalidateAllScheduleCaches();
  });

  afterEach(() => {
    invalidateAllScheduleCaches();
  });

  describe('getCachedAllMatchUps', () => {
    it('calls the factory exactly once across repeated reads', () => {
      getCachedAllMatchUps();
      getCachedAllMatchUps();
      getCachedAllMatchUps();
      expect(allTournamentMatchUpsMock).toHaveBeenCalledTimes(1);
    });

    it('refetches after invalidateMatchUpCaches', () => {
      getCachedAllMatchUps();
      invalidateMatchUpCaches();
      getCachedAllMatchUps();
      expect(allTournamentMatchUpsMock).toHaveBeenCalledTimes(2);
    });

    it('returns the same object reference within a cache window', () => {
      const a = getCachedAllMatchUps();
      const b = getCachedAllMatchUps();
      expect(a).toBe(b);
    });
  });

  describe('getCachedScheduleMatchUps', () => {
    it('keys cache entries by (date, minCourtGridRows)', () => {
      getCachedScheduleMatchUps(DATE_A, { minCourtGridRows: 10 });
      getCachedScheduleMatchUps(DATE_A, { minCourtGridRows: 10 });
      expect(competitionScheduleMatchUpsMock).toHaveBeenCalledTimes(1);

      getCachedScheduleMatchUps(DATE_B, { minCourtGridRows: 10 });
      expect(competitionScheduleMatchUpsMock).toHaveBeenCalledTimes(2);

      getCachedScheduleMatchUps(DATE_A, { minCourtGridRows: 12 });
      expect(competitionScheduleMatchUpsMock).toHaveBeenCalledTimes(3);
    });

    it('refetches every cached date after invalidateMatchUpCaches', () => {
      getCachedScheduleMatchUps(DATE_A, { minCourtGridRows: 10 });
      getCachedScheduleMatchUps(DATE_B, { minCourtGridRows: 10 });
      expect(competitionScheduleMatchUpsMock).toHaveBeenCalledTimes(2);

      invalidateMatchUpCaches();
      getCachedScheduleMatchUps(DATE_A, { minCourtGridRows: 10 });
      getCachedScheduleMatchUps(DATE_B, { minCourtGridRows: 10 });
      expect(competitionScheduleMatchUpsMock).toHaveBeenCalledTimes(4);
    });
  });

  describe('getCachedCompetitionDateRange + getCachedTournamentInfo', () => {
    it('memoizes once and survives matchUp-only invalidation', () => {
      getCachedCompetitionDateRange();
      getCachedTournamentInfo();
      invalidateMatchUpCaches();
      getCachedCompetitionDateRange();
      getCachedTournamentInfo();
      // dateRange + tournamentInfo are page-scoped — they must NOT be
      // cleared by per-mutation invalidation. Otherwise we'd defeat the
      // whole point of distinguishing the two cache lifetimes.
      expect(getCompetitionDateRangeMock).toHaveBeenCalledTimes(1);
      expect(getTournamentInfoMock).toHaveBeenCalledTimes(1);
    });

    it('refetches after invalidateAllScheduleCaches', () => {
      getCachedCompetitionDateRange();
      getCachedTournamentInfo();
      invalidateAllScheduleCaches();
      getCachedCompetitionDateRange();
      getCachedTournamentInfo();
      expect(getCompetitionDateRangeMock).toHaveBeenCalledTimes(2);
      expect(getTournamentInfoMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('syncTournamentContext', () => {
    it('is a no-op when the tournamentId is unchanged', () => {
      syncTournamentContext('t1');
      getCachedAllMatchUps();
      syncTournamentContext('t1');
      getCachedAllMatchUps();
      expect(allTournamentMatchUpsMock).toHaveBeenCalledTimes(1);
    });

    it('flushes every cache when the tournamentId changes', () => {
      syncTournamentContext('t1');
      getCachedAllMatchUps();
      getCachedCompetitionDateRange();
      getCachedTournamentInfo();
      getCachedScheduleMatchUps(DATE_A, { minCourtGridRows: 10 });

      syncTournamentContext('t2');
      getCachedAllMatchUps();
      getCachedCompetitionDateRange();
      getCachedTournamentInfo();
      getCachedScheduleMatchUps(DATE_A, { minCourtGridRows: 10 });

      expect(allTournamentMatchUpsMock).toHaveBeenCalledTimes(2);
      expect(getCompetitionDateRangeMock).toHaveBeenCalledTimes(2);
      expect(getTournamentInfoMock).toHaveBeenCalledTimes(2);
      expect(competitionScheduleMatchUpsMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('refresh-cycle scenario', () => {
    it('serves 1 allTournamentMatchUps + 1 competitionScheduleMatchUps per refresh, even with cascading subscriber fire', () => {
      // Simulates a single date-change refresh: grid render + active strip
      // + catalog + scheduleDates + issues + 3 subscriber-driven badge
      // updates (the cascade that was the original 8-call culprit).
      const date = DATE_A;
      const minRows = 10;
      const layoutParams = { minCourtGridRows: minRows };

      // refresh()
      getCachedScheduleMatchUps(date, layoutParams); // grid render
      getCachedAllMatchUps();                         // buildCatalog
      getCachedAllMatchUps();                         // buildScheduleDates
      getCachedCompetitionDateRange();                // buildScheduleDates
      getCachedTournamentInfo();                      // buildScheduleDates
      getCachedAllMatchUps();                         // buildIssues
      getCachedScheduleMatchUps(date, layoutParams); // active strip (was a 2nd factory call pre-cache)

      // store-subscription cascade (3 setX writes from refresh)
      getCachedAllMatchUps();
      getCachedAllMatchUps();
      getCachedAllMatchUps();
      getCachedAllMatchUps();

      // Net factory calls per refresh: ONE of each.
      expect(allTournamentMatchUpsMock).toHaveBeenCalledTimes(1);
      expect(competitionScheduleMatchUpsMock).toHaveBeenCalledTimes(1);
      expect(getCompetitionDateRangeMock).toHaveBeenCalledTimes(1);
      expect(getTournamentInfoMock).toHaveBeenCalledTimes(1);
    });
  });
});
