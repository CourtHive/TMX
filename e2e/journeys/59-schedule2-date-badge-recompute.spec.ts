import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 59 — Schedule2 date-selector badge recomputes after a schedule mutation.
 *
 * Regression guard for the header date-badge staleness bug. The count chip on the
 * date-selector button (schedule2Header) counts matchUps whose `schedule.scheduledDate`
 * matches the selected date. Scheduling a match (catalog → grid drop) or unscheduling
 * one (grid → catalog) must move that count in real time.
 *
 * The badge is separate from the courthive-components internal date strip, so it only
 * updates if the TMX header is explicitly refreshed. The original wiring threaded that
 * through a captured `onScheduleDatesChange` closure that could target a header a
 * re-render had already replaced, so the chip went stale. The fix registers a
 * module-level `scheduleDatesRefresher` that the grid `refresh()` calls each time —
 * always the current header, in every mutation mode.
 *
 * This drives the exact mutations a catalog↔grid drag submits (addMatchUpScheduleItems
 * setting / clearing scheduledDate via `dev.mutationRequest`) and triggers the grid
 * refresh the way the drop callback does (`context.refreshActiveTable` → refreshGridView),
 * asserting the chip goes 1 → 2 → 1.
 */

const SCHEDULE_DATE = new Date().toISOString().slice(0, 10);

interface BadgeSeed {
  tournamentId: string;
  scheduledMatchUpId: string;
  unscheduledMatchUpId: string;
  drawId: string;
  courtId: string;
  venueId: string;
}

/**
 * Seed a 4-draw SE event on today's date with a 2-court venue. Schedule ONE
 * round-1 matchUp onto today (badge starts at 1) and leave the other round-1
 * matchUp fully unscheduled (it sits in the catalog).
 */
async function seedOneScheduledOneCatalog(page: import('@playwright/test').Page): Promise<BadgeSeed> {
  return page.evaluate(
    async ({ date }) => {
      try {
        await dev.tmx2db.initDB();

        const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
          nonRandom: 1,
          setState: true,
          tournamentName: 'E2E Date Badge Recompute',
          tournamentAttributes: {
            tournamentId: 'e2e-date-badge-recompute',
            startDate: date,
            endDate: date,
          },
          drawProfiles: [{ eventName: 'Singles', drawSize: 4, drawType: 'SINGLE_ELIMINATION' }],
          venueProfiles: [{ courtsCount: 2, venueName: 'Badge Venue' }],
        });

        const round1: any[] = (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).filter(
          (m: any) => m.matchUpStatus !== 'BYE' && m.roundNumber === 1,
        );
        if (round1.length < 2) throw new Error('seed: need two round-1 matchUps');

        const { venues } = dev.factory.tournamentEngine.getVenuesAndCourts();
        const venue = venues?.[0];
        const court = venue?.courts?.[0];
        if (!venue?.venueId || !court?.courtId) throw new Error('seed: venue/court not generated');

        // Schedule only the first round-1 matchUp onto today.
        dev.factory.tournamentEngine.addMatchUpScheduleItems({
          matchUpId: round1[0].matchUpId,
          drawId: round1[0].drawId,
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
          scheduledMatchUpId: round1[0].matchUpId as string,
          unscheduledMatchUpId: round1[1].matchUpId as string,
          drawId: round1[1].drawId as string,
          courtId: court.courtId as string,
          venueId: venue.venueId as string,
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

/** Apply a schedule mutation via the live mutationRequest bridge, then trigger the grid refresh. */
async function scheduleThroughMutationRequest(
  page: import('@playwright/test').Page,
  params: { matchUpId: string; drawId: string; schedule: Record<string, any> },
): Promise<void> {
  await page.evaluate(
    async ({ matchUpId, drawId, schedule }) => {
      await new Promise<void>((resolve) => {
        dev.mutationRequest({
          methods: [
            { method: 'addMatchUpScheduleItems', params: { matchUpId, drawId, schedule, removePriorValues: true } },
          ],
          callback: () => {
            // Mirror the drop callback: refresh the active surface (wired to refreshGridView).
            dev.tournamentContext.refreshActiveTable?.();
            resolve();
          },
        });
      });
    },
    params,
  );
}

test.describe('Journey 59 — Schedule2 date badge recomputes on schedule / unschedule', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('date-selector chip goes 1 → 2 when a catalog match is scheduled, and back to 1 when unscheduled', async ({
    page,
  }) => {
    const seed = await seedOneScheduledOneCatalog(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(seed.tournamentId);
    await tournament.navigateToScheduling();

    const badge = page.locator('button:has(i.fa-calendar-days) span').first();
    // One match is scheduled for today → chip reads 1.
    await expect(badge).toHaveText('1', { timeout: 15_000 });

    // Catalog → grid: schedule the second match onto today. Chip must climb to 2.
    await scheduleThroughMutationRequest(page, {
      matchUpId: seed.unscheduledMatchUpId,
      drawId: seed.drawId,
      schedule: {
        scheduledDate: SCHEDULE_DATE,
        scheduledTime: '11:00',
        venueId: seed.venueId,
        courtId: seed.courtId,
        courtOrder: 2,
      },
    });
    await expect(badge).toHaveText('2');

    // Grid → catalog: unschedule it (clear date/time/court). Chip must fall back to 1.
    await scheduleThroughMutationRequest(page, {
      matchUpId: seed.unscheduledMatchUpId,
      drawId: seed.drawId,
      schedule: { scheduledDate: '', scheduledTime: '', venueId: '', courtId: '', courtOrder: '' },
    });
    await expect(badge).toHaveText('1');
  });
});
