import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 48 — Schedule2 grid reflects a score entered via the scoring modal.
 *
 * Regression guard for the schedule2DataCache staleness bug. The cache
 * (perf commit 8d5b3ee1) memoizes factory matchUp reads and originally only
 * invalidated when a mutation routed through the schedule's own
 * `executeMethods` (drag/drop, unschedule, bulk save). Entering a score from
 * the cell popover calls `enterMatchUpScore` → `mutationRequest` DIRECTLY,
 * bypassing `executeMethods`, so the post-modal `refreshGridView()` read the
 * stale (pre-score) cache and the grid never showed the new score.
 *
 * The fix routes every `mutationRequest` through a central
 * `notifyMutationApplied()` after its local executionQueue; the cache
 * subscribes and self-invalidates. This test drives the exact same mutation
 * the scoring modal submits (a `setMatchUpStatus` outcome via the real
 * `dev.mutationRequest` bridge) and then triggers the grid's refresh the way
 * the modal callback does (`context.refreshActiveTable`, which is wired to
 * `refreshGridView`). It asserts the cell goes from no-score to showing the
 * entered score — failing if the cache is served stale.
 */

const SCHEDULE_DATE = new Date().toISOString().slice(0, 10);
const SCORE_STRING = '6-2 6-3';

interface ScoreSeed {
  tournamentId: string;
  matchUpId: string;
  drawId: string;
}

/**
 * Seed a 4-draw SE event with full participants, then place the first
 * round-1 matchUp onto a court for today (courtId + venueId + courtOrder),
 * exactly the on-court state a cell needs to render. The matchUp is left
 * unscored — the test scores it through the live mutation path.
 */
async function seedCourtScheduledMatchUp(page: import('@playwright/test').Page): Promise<ScoreSeed> {
  return page.evaluate(
    async ({ date }) => {
      try {
        await dev.tmx2db.initDB();

        const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
          setState: true,
          tournamentName: 'E2E Score Entry Refresh',
          tournamentAttributes: {
            tournamentId: 'e2e-score-entry-refresh',
            startDate: date,
            endDate: date,
          },
          drawProfiles: [
            { eventName: 'Singles', drawSize: 4, drawType: 'SINGLE_ELIMINATION' },
          ],
          venueProfiles: [{ courtsCount: 2, venueName: 'Score Venue' }],
        });

        const round1: any = (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).find(
          (m: any) => m.matchUpStatus !== 'BYE' && m.roundNumber === 1,
        );
        if (!round1) throw new Error('seedCourtScheduledMatchUp: no round-1 matchUp found');

        const { venues } = dev.factory.tournamentEngine.getVenuesAndCourts();
        const venue = venues?.[0];
        const court = venue?.courts?.[0];
        if (!venue?.venueId || !court?.courtId) {
          throw new Error('seedCourtScheduledMatchUp: venue/court not generated');
        }

        dev.factory.tournamentEngine.addMatchUpScheduleItems({
          matchUpId: round1.matchUpId,
          drawId: round1.drawId,
          schedule: {
            scheduledDate: date,
            scheduledTime: '10:00',
            venueId: venue.venueId,
            courtId: court.courtId,
            courtOrder: 1,
          },
        });

        const mutated = dev.factory.tournamentEngine.getTournament().tournamentRecord;
        await dev.tmx2db.addTournament(mutated);

        return {
          tournamentId: tournamentRecord.tournamentId as string,
          matchUpId: round1.matchUpId as string,
          drawId: round1.drawId as string,
        };
      } catch (err: any) {
        throw new Error(
          `${err?.name || 'Error'}: ${err?.message || String(err)} | stack: ${err?.stack?.split('\n').slice(0, 3).join(' || ')}`,
        );
      }
    },
    { date: SCHEDULE_DATE },
  );
}

/**
 * Score the matchUp the same way the scoring modal does: build sets from a
 * score string, submit a `setMatchUpStatus` outcome through the real
 * `dev.mutationRequest` bridge, and — on the mutation callback — trigger the
 * grid refresh via `context.refreshActiveTable` (wired to `refreshGridView`
 * while the grid view is mounted). This mirrors `scoreMatchUp.ts` +
 * `schedule2CellActions.ts`'s `callback: () => onRefresh()`.
 */
async function scoreMatchUpThroughMutationRequest(
  page: import('@playwright/test').Page,
  seed: ScoreSeed,
  scoreString: string,
): Promise<void> {
  await page.evaluate(
    async ({ matchUpId, drawId, scoreString }) => {
      const sets = dev.factory.tournamentEngine.parseScoreString({ scoreString }) || [];
      await new Promise<void>((resolve) => {
        dev.mutationRequest({
          methods: [
            {
              method: 'setMatchUpStatus',
              params: {
                allowChangePropagation: true,
                drawId,
                outcome: {
                  score: { sets },
                  matchUpStatus: 'COMPLETED',
                  winningSide: 1,
                },
                matchUpId,
              },
            },
          ],
          callback: () => {
            // The scoring modal's callback re-renders the active surface.
            // For schedule2 the grid wires refreshGridView here.
            dev.tournamentContext.refreshActiveTable?.();
            resolve();
          },
        });
      });
    },
    { matchUpId: seed.matchUpId, drawId: seed.drawId, scoreString },
  );
}

test.describe('Journey 48 — Schedule2 score entry refreshes the grid cell', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('entering a score updates the on-court grid cell (cache not served stale)', async ({ page }) => {
    const seed = await seedCourtScheduledMatchUp(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(seed.tournamentId);
    await tournament.navigateToScheduling();

    // The matchUp's on-court cell renders, with no score yet.
    const cell = page.locator(`[data-matchup-id="${seed.matchUpId}"]`).first();
    await cell.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(cell.locator('.spl-grid-cell__score')).toHaveCount(0);

    // Score it through the live mutation + refresh path the modal uses.
    await scoreMatchUpThroughMutationRequest(page, seed, SCORE_STRING);

    // The grid cell must now show the entered score. Before the cache fix
    // this stayed empty because refreshGridView read the stale matchUp cache.
    await expect(page.locator(`[data-matchup-id="${seed.matchUpId}"]`).first().locator('.spl-grid-cell__score')).toHaveText(
      SCORE_STRING,
    );
  });
});
