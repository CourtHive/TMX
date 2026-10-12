import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the engine BEFORE importing the cache so the module captures the
// mock reference, not the real factory. Each test resets the call counts
// to make per-test assertions precise.
const allTournamentMatchUpsMock = vi.fn();
const competitionScheduleMatchUpsMock = vi.fn();
const getCompetitionDateRangeMock = vi.fn();
const getTournamentInfoMock = vi.fn();
const proConflictsMock = vi.fn();

vi.mock('services/factory/engine', () => ({
  competitionEngine: {
    allTournamentMatchUps: (...args: any[]) => allTournamentMatchUpsMock(...args),
    competitionScheduleMatchUps: (...args: any[]) => competitionScheduleMatchUpsMock(...args),
    getCompetitionDateRange: (...args: any[]) => getCompetitionDateRangeMock(...args),
    getTournamentInfo: (...args: any[]) => getTournamentInfoMock(...args),
    proConflicts: (...args: any[]) => proConflictsMock(...args),
  },
  tournamentEngine: {},
}));

import { notifyTournamentContextChanged } from 'services/tournament/tournamentContextObservers';
import { notifyMutationApplied } from 'services/mutation/mutationObservers';
import {
  getCachedAllMatchUps,
  getCachedScheduleMatchUps,
  getCachedCompetitionDateRange,
  getCachedTournamentInfo,
  getCachedProConflicts,
  getCachedMatchUpById,
  invalidateMatchUpCaches,
  invalidateAllScheduleCaches,
} from './schedule2DataCache';

const DATE_A = '2026-06-13';
const DATE_B = '2026-06-14';

describe('schedule2DataCache', () => {
  beforeEach(() => {
    allTournamentMatchUpsMock.mockReset().mockReturnValue({ matchUps: [] });
    competitionScheduleMatchUpsMock.mockReset().mockReturnValue({ courtsData: [], rows: [] });
    getCompetitionDateRangeMock.mockReset().mockReturnValue({ startDate: DATE_A, endDate: '2026-06-15' });
    getTournamentInfoMock.mockReset().mockReturnValue({ tournamentInfo: { tournamentId: 't1' } });
    proConflictsMock.mockReset().mockReturnValue({ courtIssues: {}, rowIssues: {} });
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

  describe('tournament-context subscription', () => {
    // The cache subscribes to onTournamentContextChanged at module load, so a
    // tournament switch (announced by the loader via notifyTournamentContextChanged)
    // drops the whole cache — the previous tournament's schedule must never
    // leak into the next one.
    it('flushes every cache when the active tournament changes', () => {
      getCachedAllMatchUps();
      getCachedCompetitionDateRange();
      getCachedTournamentInfo();
      getCachedScheduleMatchUps(DATE_A, { minCourtGridRows: 10 });
      expect(allTournamentMatchUpsMock).toHaveBeenCalledTimes(1);

      notifyTournamentContextChanged('ctx-switch-a');

      getCachedAllMatchUps();
      getCachedCompetitionDateRange();
      getCachedTournamentInfo();
      getCachedScheduleMatchUps(DATE_A, { minCourtGridRows: 10 });
      expect(allTournamentMatchUpsMock).toHaveBeenCalledTimes(2);
      expect(getCompetitionDateRangeMock).toHaveBeenCalledTimes(2);
      expect(getTournamentInfoMock).toHaveBeenCalledTimes(2);
      expect(competitionScheduleMatchUpsMock).toHaveBeenCalledTimes(2);
    });

    it('is a no-op when the same tournament is re-announced', () => {
      notifyTournamentContextChanged('ctx-stable');
      getCachedAllMatchUps();
      notifyTournamentContextChanged('ctx-stable');
      getCachedAllMatchUps();
      expect(allTournamentMatchUpsMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('mutation-applied subscription', () => {
    // The cache subscribes to the central mutation-applied notification at
    // module load. This is what makes score entry from the scoring modal —
    // which calls mutationRequest directly, NOT the schedule's executeMethods —
    // drop the stale matchUp cache so the grid re-render shows the new score.
    it('refetches matchUp caches after a mutation is applied', () => {
      getCachedAllMatchUps();
      getCachedScheduleMatchUps(DATE_A, { minCourtGridRows: 10 });
      expect(allTournamentMatchUpsMock).toHaveBeenCalledTimes(1);
      expect(competitionScheduleMatchUpsMock).toHaveBeenCalledTimes(1);

      notifyMutationApplied();

      getCachedAllMatchUps();
      getCachedScheduleMatchUps(DATE_A, { minCourtGridRows: 10 });
      expect(allTournamentMatchUpsMock).toHaveBeenCalledTimes(2);
      expect(competitionScheduleMatchUpsMock).toHaveBeenCalledTimes(2);
    });

    it('leaves page-scoped caches intact after a mutation is applied', () => {
      getCachedCompetitionDateRange();
      getCachedTournamentInfo();

      notifyMutationApplied();

      getCachedCompetitionDateRange();
      getCachedTournamentInfo();
      // Date range + tournamentInfo do not change in response to matchUp
      // mutations — they survive, matching invalidateMatchUpCaches semantics.
      expect(getCompetitionDateRangeMock).toHaveBeenCalledTimes(1);
      expect(getTournamentInfoMock).toHaveBeenCalledTimes(1);
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
      getCachedAllMatchUps(); // buildCatalog
      getCachedAllMatchUps(); // buildScheduleDates
      getCachedCompetitionDateRange(); // buildScheduleDates
      getCachedTournamentInfo(); // buildScheduleDates
      getCachedAllMatchUps(); // buildIssues
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

  describe('getCachedProConflicts', () => {
    const onCourt = (matchUpId: string, scheduledDate: string) => ({
      matchUpId,
      schedule: { courtId: 'c1', scheduledDate },
    });

    beforeEach(() => {
      allTournamentMatchUpsMock.mockReturnValue({
        matchUps: [
          onCourt('m1', DATE_A),
          onCourt('m2', DATE_A),
          onCourt('m3', DATE_B),
          { matchUpId: 'm4', schedule: { scheduledDate: DATE_A } },
        ],
      });
    });

    // The header indicators, the issues list and the conflict resolver ask the same question of the
    // same input; a render used to ask it three times.
    it('runs proConflicts once per date over the court-placed matchUps on that date', () => {
      const first = getCachedProConflicts(DATE_A);
      getCachedProConflicts(DATE_A);
      getCachedProConflicts(DATE_A);
      expect(proConflictsMock).toHaveBeenCalledTimes(1);
      expect(proConflictsMock.mock.calls[0][0].matchUps.map((m: any) => m.matchUpId)).toEqual(['m1', 'm2']);
      expect(first).toMatchObject({ evaluated: true, courtIssues: {}, rowIssues: {} });
      expect(first.scheduledMatchUps.map((m: any) => m.matchUpId)).toEqual(['m1', 'm2']);

      getCachedProConflicts(DATE_B);
      expect(proConflictsMock).toHaveBeenCalledTimes(2);
    });

    it('reruns after a mutation', () => {
      getCachedProConflicts(DATE_A);
      notifyMutationApplied();
      getCachedProConflicts(DATE_A);
      expect(proConflictsMock).toHaveBeenCalledTimes(2);
    });

    it('is not evaluated when nothing is on a court that day, or when proConflicts refuses', () => {
      expect(getCachedProConflicts('2026-01-01')).toMatchObject({ evaluated: false, scheduledMatchUps: [] });
      expect(proConflictsMock).not.toHaveBeenCalled();

      proConflictsMock.mockReturnValue({ error: { message: 'nope' } });
      const refused = getCachedProConflicts(DATE_A);
      expect(refused.evaluated).toBe(false);
      expect(refused.scheduledMatchUps).toHaveLength(2);
    });
  });

  describe('getCachedMatchUpById', () => {
    it('maps the cached matchUps by id, and drops the map with them', () => {
      allTournamentMatchUpsMock.mockReturnValue({ matchUps: [{ matchUpId: 'm1' }, { matchUpId: 'm2' }] });
      expect(getCachedMatchUpById().get('m2')).toEqual({ matchUpId: 'm2' });
      expect(getCachedMatchUpById()).toBe(getCachedMatchUpById());

      allTournamentMatchUpsMock.mockReturnValue({ matchUps: [{ matchUpId: 'm3' }] });
      invalidateMatchUpCaches();
      expect(getCachedMatchUpById().has('m2')).toBe(false);
      expect(getCachedMatchUpById().get('m3')).toEqual({ matchUpId: 'm3' });
    });
  });
});
