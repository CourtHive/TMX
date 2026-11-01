import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';
import { EventDrawer } from '../pages/EventDrawer';
import { todayLocal } from '../helpers/dates';

/**
 * Journey 188 — an event's own match timing reaches the schedule grid.
 *
 * The director opens the event drawer, opens Match timing, changes the average for the event's format and saves.
 * The schedule grid's expected duration for that event's matchUp (the Inspector's timing figures, the number the
 * runway and the block guard also read) must move from the scheduling policy's figure to the event's.
 *
 * The event has a category: published factory 7.27.0 ignores an uncategorized event's timing in the grid's read.
 * That case is unit-tested, gated on the release that fixes it.
 */

const SCHEDULE_DATE = todayLocal();
const FORMAT = 'SET3-S:6/TB7';

const INSPECTOR = '[data-panel="inspector"]';
const CATALOG_PANEL = '[data-panel="catalog"]';
const UNSCHEDULED_TAB = 'button[data-sidebar-tab="unscheduled"]';
const CARD = '.spl-matchup-card';
const TIMING = `${INSPECTOR} .tmx-timing`;

type Seed = { tournamentId: string; eventId: string; matchUpId: string };

async function seedEvent(page: import('@playwright/test').Page): Promise<Seed> {
  return page.evaluate(
    async ({ date, format }) => {
      await dev.tmx2db.initDB();
      const { tournamentRecord, eventIds } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        tournamentName: 'E2E Event Timing',
        tournamentAttributes: { tournamentId: 'e2e-event-timing', startDate: date, endDate: date },
        eventProfiles: [
          {
            eventName: 'U18 Singles',
            category: { categoryName: 'U18', categoryType: 'JUNIOR' },
            drawProfiles: [{ drawSize: 8, matchUpFormat: format, drawType: 'SINGLE_ELIMINATION' }],
          },
        ],
        venueProfiles: [{ courtsCount: 2, venueName: 'Timing Venue' }],
      });
      const eventId = eventIds[0];
      const matchUps = dev.factory.competitionEngine.allTournamentMatchUps({ inContext: true }).matchUps || [];
      const target = matchUps.find(
        (m: any) => m.eventId === eventId && m.roundNumber === 1 && m.matchUpStatus !== 'BYE',
      );
      if (!target) throw new Error('seed produced no first-round matchUp');
      await dev.tmx2db.addTournament(dev.factory.tournamentEngine.getTournament().tournamentRecord);
      return { tournamentId: tournamentRecord.tournamentId as string, eventId, matchUpId: target.matchUpId as string };
    },
    { date: SCHEDULE_DATE, format: FORMAT },
  );
}

async function inspectMatchUp(page: import('@playwright/test').Page, matchUpId: string) {
  await new TournamentPage(page).navigateToScheduling();
  await page.locator(UNSCHEDULED_TAB).click();
  await page.locator(CATALOG_PANEL).waitFor({ state: 'visible', timeout: 10_000 });
  await page.locator(`${CARD}[data-matchup-id="${matchUpId}"]`).click();
  return page.locator(TIMING);
}

test.describe('Journey 188 — event match timing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test("changing a format's timing in the event drawer moves the grid's expected duration", async ({ page }) => {
    const seed = await seedEvent(page);
    const tournament = new TournamentPage(page);
    await tournament.goto(seed.tournamentId);

    // the control: before any change, the grid reads the scheduling policy's figure
    const before = await inspectMatchUp(page, seed.matchUpId);
    await expect(before.locator('.tmx-timing-figures')).toContainText('1h 30m average');

    await page.goto(`/#/tournament/${seed.tournamentId}/event/${seed.eventId}`);
    const drawer = new EventDrawer(page);
    await drawer.openFromEventPage();
    await expect(drawer.heading('Dates & days')).toBeVisible();
    await expect(drawer.timingSummary).toHaveText('Policy defaults');

    await drawer.openTiming();
    await expect(drawer.timingSource(FORMAT)).toHaveAttribute('data-source', 'policy');
    await expect(drawer.timingInput(FORMAT, 'averageMinutes')).toHaveValue('90');
    await drawer.setTiming(FORMAT, { averageMinutes: 75 });
    await drawer.saveTiming();

    await expect(drawer.timingSummary).toHaveText('1 format customised');
    await drawer.close();

    const after = await inspectMatchUp(page, seed.matchUpId);
    await expect(after.locator('.tmx-timing-figures')).toContainText('1h 15m average');
    await expect(after).toHaveAttribute('data-timing-source', 'eventTiming');
  });
});
