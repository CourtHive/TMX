import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 29 — Schedule2 active courts strip
 *
 * Validates the one-row "active courts" strip rendered above the court grid:
 *   - Renders one cell per visible court, with a leading "Now" spacer.
 *   - A scheduled TO_BE_PLAYED matchUp surfaces on its court as state "next"
 *     with a NEXT pill.
 *   - An IN_PROGRESS matchUp surfaces as state "in-progress" with a LIVE pill.
 *   - The header toggle button hides and re-shows the strip.
 *
 * The drag-drop row inference is unit-tested in courthive-components
 * (computeActiveStripDropTarget — 23 cases). This journey exercises the live
 * data path and DOM contract.
 */

const STRIP_SELECTOR = '.spl-active-strip';
const CELL_SELECTOR = '.spl-active-strip-cell';
const SPACER_LABEL_SELECTOR = '.spl-active-strip-spacer-label';
const STATE_PILL_SELECTOR = '.spl-active-strip-state-pill';

const SCHEDULE_DATE = new Date().toISOString().slice(0, 10);

const PROFILE_STRIP = {
  tournamentName: 'E2E Active Strip',
  tournamentAttributes: {
    tournamentId: 'e2e-active-strip',
    startDate: SCHEDULE_DATE,
    endDate: SCHEDULE_DATE,
  },
  participantsProfile: { scaledParticipantsCount: 16 },
  drawProfiles: [
    {
      eventName: 'Strip Singles',
      drawSize: 8,
      seedsCount: 2,
      drawType: 'SINGLE_ELIMINATION',
    },
  ],
  venueProfiles: [{ courtsCount: 4, venueName: 'Strip Test Venue' }],
};

interface ScheduledTarget {
  courtId: string;
  matchUpId: string;
  drawId: string;
}

/**
 * Place the first matchUp from the seeded draw onto the first court for
 * SCHEDULE_DATE. Returns the targeted IDs so the test can assert against
 * the rendered cell.
 */
async function scheduleFirstMatchUp(page: import('@playwright/test').Page): Promise<ScheduledTarget> {
  return page.evaluate((date) => {
    const venues = dev.factory.tournamentEngine.getVenuesAndCourts()?.venues || [];
    const targetCourt = (venues[0]?.courts || [])[0];
    if (!targetCourt) throw new Error('No court available in seeded venue');

    const matchUps = dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || [];
    const target = matchUps.find((m: any) => m.matchUpStatus !== 'BYE') ?? matchUps[0];
    if (!target) throw new Error('No matchUp available in seeded draw');

    dev.factory.tournamentEngine.addMatchUpScheduleItems({
      matchUpId: target.matchUpId,
      drawId: target.drawId,
      schedule: {
        scheduledDate: date,
        courtId: targetCourt.courtId,
        courtOrder: 1,
        venueId: targetCourt.venueId,
      },
    });

    return {
      courtId: targetCourt.courtId,
      matchUpId: target.matchUpId,
      drawId: target.drawId,
    };
  }, SCHEDULE_DATE);
}

test.describe('Journey 29 — Schedule2 active courts strip', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    // The strip's visibility flag and the schedule2 selected-date are stored
    // in localStorage. Clear them so each test starts from defaults.
    await page.evaluate(() => localStorage.clear());
  });

  test('renders one cell per visible court with a "Now" spacer label', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_STRIP);
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToSchedule2();

    await page.waitForSelector(STRIP_SELECTOR, { timeout: 10_000 });

    const cellCount = await page.locator(CELL_SELECTOR).count();
    expect(cellCount).toBe(4);

    await expect(page.locator(SPACER_LABEL_SELECTOR)).toHaveText('Now');

    // No scheduled matchUps yet — every cell is free.
    const cells = page.locator(CELL_SELECTOR);
    for (let i = 0; i < cellCount; i++) {
      await expect(cells.nth(i)).toHaveClass(/state-free/);
    }
  });

  test('a scheduled TBP matchUp surfaces on its court as NEXT', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_STRIP);
    const target = await scheduleFirstMatchUp(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToSchedule2();
    await page.waitForSelector(STRIP_SELECTOR, { timeout: 10_000 });

    const cell = page.locator(`${CELL_SELECTOR}[data-court-id="${target.courtId}"]`);
    await expect(cell).toHaveClass(/state-next/);
    await expect(cell.locator(STATE_PILL_SELECTOR)).toHaveText('NEXT');

    // Other courts remain free.
    const freeCells = page.locator(`${CELL_SELECTOR}.state-free`);
    expect(await freeCells.count()).toBe(3);
  });

  test('an IN_PROGRESS matchUp surfaces on its court as LIVE', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_STRIP);
    const target = await scheduleFirstMatchUp(page);

    await page.evaluate(({ matchUpId, drawId }) => {
      dev.factory.tournamentEngine.setMatchUpStatus({
        matchUpId,
        drawId,
        outcome: { matchUpStatus: 'IN_PROGRESS' },
      });
    }, target);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToSchedule2();
    await page.waitForSelector(STRIP_SELECTOR, { timeout: 10_000 });

    const cell = page.locator(`${CELL_SELECTOR}[data-court-id="${target.courtId}"]`);
    await expect(cell).toHaveClass(/state-in-progress/);
    await expect(cell.locator(STATE_PILL_SELECTOR)).toHaveText('LIVE');
  });

  test('header toggle hides and re-shows the strip', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_STRIP);
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToSchedule2();

    const strip = page.locator(STRIP_SELECTOR);
    await expect(strip).toBeVisible();

    // The toggle button title is "Hide active courts strip" / "Show active courts strip".
    const toggleBtn = page.locator('button[title*="active courts strip"]').first();
    await toggleBtn.click();
    await expect(strip).toBeHidden();

    await toggleBtn.click();
    await expect(strip).toBeVisible();
  });
});
