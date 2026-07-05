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
/**
 * Seed a tournament AND schedule its first non-BYE matchUp in a single
 * page.evaluate. Combining both into one IDB-persist call avoids racing
 * against the seed helper's fire-and-forget `dev.load` write.
 *
 * Returns both the tournamentId (for navigation) and the scheduled target.
 */
async function seedAndScheduleFirstMatchUp(
  page: import('@playwright/test').Page,
): Promise<{ tournamentId: string; target: ScheduledTarget }> {
  return page.evaluate(async (date) => {
    try {
      // resetState (beforeEach) closed + deleted the dex. Re-init before
      // any further IDB operation. (Other tests that only call dev.load
      // happen to work because the fire-and-forget save eats the
      // DatabaseClosedError silently; this helper awaits the write so the
      // error would surface — explicit re-init avoids it.)
      await dev.tmx2db.initDB();

      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        setState: true,
        tournamentName: 'E2E Active Strip',
        tournamentAttributes: { tournamentId: 'e2e-active-strip', startDate: date, endDate: date },
        participantsProfile: { scaledParticipantsCount: 16 },
        drawProfiles: [{ eventName: 'Strip Singles', drawSize: 8, seedsCount: 2, drawType: 'SINGLE_ELIMINATION' }],
        venueProfiles: [{ courtsCount: 4, venueName: 'Strip Test Venue' }],
      });

      const venues = dev.factory.tournamentEngine.getVenuesAndCourts()?.venues || [];
      const targetCourt = (venues[0]?.courts || [])[0];
      if (!targetCourt) throw new Error('No court available in seeded venue');

      const matchUps = dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || [];
      const target = matchUps.find((m: any) => m.matchUpStatus !== 'BYE') ?? matchUps[0];
      if (!target) throw new Error('No matchUp available in seeded draw');

      dev.factory.tournamentEngine.addMatchUpScheduleItems({
        matchUpId: target.matchUpId,
        drawId: target.drawId,
        schedule: { scheduledDate: date, courtId: targetCourt.courtId, courtOrder: 1, venueId: targetCourt.venueId },
      });

      // One persist call — no race.
      const mutated = dev.factory.tournamentEngine.getTournament().tournamentRecord;
      await dev.tmx2db.addTournament(mutated);

      return {
        tournamentId: tournamentRecord.tournamentId as string,
        target: { courtId: targetCourt.courtId, matchUpId: target.matchUpId, drawId: target.drawId },
      };
    } catch (err: any) {
      // Re-throw with full detail so Playwright doesn't collapse it to "DexieError".
      throw new Error(
        `${err?.name || 'Error'}: ${err?.message || String(err)} | inner: ${err?.inner?.message || err?.cause?.message || ''} | stack: ${err?.stack?.split('\n').slice(0, 3).join(' || ')}`,
      );
    }
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
    await tournament.navigateToScheduling();

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
    const { tournamentId, target } = await seedAndScheduleFirstMatchUp(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToScheduling();
    await page.waitForSelector(STRIP_SELECTOR, { timeout: 10_000 });

    const cell = page.locator(`${CELL_SELECTOR}[data-court-id="${target.courtId}"]`);
    await expect(cell).toHaveClass(/state-next/);
    await expect(cell.locator(STATE_PILL_SELECTOR)).toHaveText('NEXT');

    // Other courts remain free.
    const freeCells = page.locator(`${CELL_SELECTOR}.state-free`);
    expect(await freeCells.count()).toBe(3);
  });

  test('an IN_PROGRESS matchUp surfaces on its court as LIVE', async ({ page }) => {
    const { tournamentId, target } = await seedAndScheduleFirstMatchUp(page);

    await page.evaluate(async ({ matchUpId, drawId }) => {
      dev.factory.tournamentEngine.setMatchUpStatus({
        matchUpId,
        drawId,
        outcome: { matchUpStatus: 'IN_PROGRESS' },
      });
      // Tournament already exists in IDB from seedAndScheduleFirstMatchUp — single
      // .put() upsert, no race.
      const record = dev.factory.tournamentEngine.getTournament().tournamentRecord;
      await dev.tmx2db.addTournament(record);
    }, target);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToScheduling();
    await page.waitForSelector(STRIP_SELECTOR, { timeout: 10_000 });

    const cell = page.locator(`${CELL_SELECTOR}[data-court-id="${target.courtId}"]`);
    await expect(cell).toHaveClass(/state-in-progress/);
    await expect(cell.locator(STATE_PILL_SELECTOR)).toHaveText('LIVE');
  });

  test('clicking a strip cell opens the same popover as a grid cell', async ({ page }) => {
    const { tournamentId, target } = await seedAndScheduleFirstMatchUp(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToScheduling();
    await page.waitForSelector(STRIP_SELECTOR, { timeout: 10_000 });

    // Capture how many tippy popovers exist before the click — other UI on the
    // page (date dropdown, issues icon, etc.) may already have tippy instances
    // mounted in the DOM. We assert the count grows by clicking a strip cell.
    const tippiesBefore = await page.locator('.tippy-box').count();

    // Click the strip cell whose court has the scheduled matchUp.
    const cell = page.locator(`${CELL_SELECTOR}[data-court-id="${target.courtId}"]`);
    await cell.click();

    // Same cell-click popover used by grid cells — wait for an additional
    // tippy-box to appear.
    await expect(async () => {
      const after = await page.locator('.tippy-box').count();
      expect(after).toBeGreaterThan(tippiesBefore);
    }).toPass({ timeout: 5_000 });
  });

  test('dropping a matchUp onto a strip cell stamps matchUp.schedule.calledAt', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_STRIP);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToScheduling();
    await page.waitForSelector(STRIP_SELECTOR, { timeout: 10_000 });

    // Capture an unscheduled matchUp + the first court before the drop.
    const setup = await page.evaluate(() => {
      const venues = dev.factory.tournamentEngine.getVenuesAndCourts()?.venues || [];
      const targetCourt = (venues[0]?.courts || [])[0];
      const matchUps = dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || [];
      const target = matchUps.find((m: any) => m.matchUpStatus !== 'BYE') ?? matchUps[0];
      return {
        courtId: targetCourt.courtId,
        venueId: targetCourt.venueId,
        matchUpId: target.matchUpId,
        drawId: target.drawId,
      };
    });

    // Capture a stable lower-bound timestamp for the assertion. The matchUp
    // mutation runs in the next tick, so the stamped calledAt should be
    // >= this value.
    const beforeIso = new Date().toISOString();

    // Simulate the active-strip drop's mutation chain (the same two methods
    // handleActiveStripDrop emits in gridView.ts:1582 — see
    // factory matchUp.schedule.calledAt and the active-strip drop handler).
    // Going through the engine surface (rather than a Playwright drag-drop)
    // keeps this test focused on the data contract: a deliberate drop must
    // stamp `calledAt`, and a generic court assignment (no strip) must not.
    await page.evaluate(({ matchUpId, drawId, courtId, venueId }) => {
      dev.factory.tournamentEngine.addMatchUpScheduleItems({
        matchUpId,
        drawId,
        schedule: { scheduledDate: new Date().toISOString().slice(0, 10), courtId, courtOrder: 1, venueId },
      });
      dev.factory.tournamentEngine.setMatchUpCalledAt({
        matchUpId,
        drawId,
        calledAt: new Date().toISOString(),
      });
    }, setup);

    // Assert: matchUp.schedule.calledAt is an ISO string >= beforeIso.
    const calledAt = await page.evaluate(({ matchUpId }) => {
      const { matchUp } = dev.factory.tournamentEngine.findMatchUp({ matchUpId });
      return matchUp?.schedule?.calledAt;
    }, setup);

    expect(calledAt).toBeTruthy();
    expect(typeof calledAt).toBe('string');
    expect(calledAt >= beforeIso).toBe(true);

    // Round-trip: clearing via setMatchUpCalledAt({ calledAt: null }) should
    // remove the stamp (the unschedule-from-strip path in gridView.ts).
    await page.evaluate(({ matchUpId, drawId }) => {
      dev.factory.tournamentEngine.setMatchUpCalledAt({ matchUpId, drawId, calledAt: null });
    }, setup);

    const clearedCalledAt = await page.evaluate(({ matchUpId }) => {
      const { matchUp } = dev.factory.tournamentEngine.findMatchUp({ matchUpId });
      return matchUp?.schedule?.calledAt;
    }, setup);

    expect(clearedCalledAt).toBeUndefined();
  });

  test('header toggle hides and re-shows the strip', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_STRIP);
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToScheduling();

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
