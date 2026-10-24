import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';
import { todayLocal } from '../helpers/dates';

/**
 * Journey 181 — the schedule catalog's "collapse all", and the collapsed groups surviving navigation.
 *
 * CA, 2026-10-24: one control collapses every grouping of the catalog (by time, by event, …). Beside the
 * sidebar it sits right-justified on the Unscheduled / Scheduled row; in the bottom strip it sits after
 * the group-by select and before the ◀ ▶ card navigation. Which groups are collapsed survives leaving
 * the schedule page and coming back, and is cleared when a tournament is loaded.
 */

const DATE = todayLocal();
const COLLAPSE_ALL = 'button.tmx-catalog-collapse-all';
const CATALOG = '[data-panel="catalog"]';
const SCHEDULED_PANEL = '[data-sidebar-panel="scheduled"]';
const UNSCHEDULED_TAB = 'button[data-sidebar-tab="unscheduled"]';
const SCHEDULED_TAB = 'button[data-sidebar-tab="scheduled"]';

async function seed(page: Page, { scheduleFirstRound }: { scheduleFirstRound: boolean }): Promise<string> {
  return page.evaluate(
    async ({ date, scheduleFirstRound }) => {
      await dev.tmx2db.initDB();
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        tournamentName: 'E2E Collapse All',
        tournamentAttributes: { tournamentId: 'e2e-collapse-all', startDate: date, endDate: date },
        drawProfiles: [
          { drawSize: 8, eventName: 'Alpha Singles' },
          { drawSize: 8, eventName: 'Bravo Singles' },
        ],
        venueProfiles: [{ courtsCount: 4, venueName: 'Collapse Venue' }],
      });
      if (scheduleFirstRound) {
        const round1 = dev.factory.competitionEngine
          .allTournamentMatchUps({})
          .matchUps.filter((m: any) => m.roundNumber === 1);
        for (const m of round1) {
          dev.factory.tournamentEngine.addMatchUpScheduleItems({
            matchUpId: m.matchUpId,
            drawId: m.drawId,
            schedule: { scheduledDate: date, scheduledTime: '09:00' },
          });
        }
      }
      await dev.tmx2db.addTournament(dev.factory.tournamentEngine.getTournament().tournamentRecord);
      return tournamentRecord.tournamentId as string;
    },
    { date: DATE, scheduleFirstRound },
  );
}

/** `aria-expanded` of every group header the panel shows; the Scheduled panel's headers carry none. */
const headerStates = (page: Page, panel: string) =>
  page.locator(`${panel} .sp-group-header`).evaluateAll((els) =>
    els.map((el) => {
      if (el.hasAttribute('aria-expanded')) return el.getAttribute('aria-expanded') === 'true';
      return el.querySelector('.sp-group-chevron')?.textContent === '▼';
    }),
  );

const cardCount = (page: Page, panel: string) => page.locator(`${panel} .spl-matchup-card`).count();

test.describe('Journey 181 — schedule catalog collapse all', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('Unscheduled: collapses and expands every group, keeps it across pages, clears on tournament load', async ({
    page,
  }) => {
    const tournamentId = await seed(page, { scheduleFirstRound: false });
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToScheduling();
    await page.locator(UNSCHEDULED_TAB).click();

    // Beside the sidebar: on the Unscheduled / Scheduled row, after both chips.
    const button = page.locator(`.tmx-catalog-control-strip > ${COLLAPSE_ALL}`);
    await expect(button).toBeVisible();
    await expect.poll(() => headerStates(page, CATALOG)).toEqual([true, true]);
    expect(await cardCount(page, CATALOG)).toBeGreaterThan(0);

    await button.click();
    await expect.poll(() => headerStates(page, CATALOG)).toEqual([false, false]);
    expect(await cardCount(page, CATALOG)).toBe(0);
    await expect(button).toHaveAttribute('data-all-collapsed', 'true');

    // Away and back within the tournament: still collapsed.
    await tournament.navigateToEvents();
    await tournament.navigateToScheduling();
    await page.locator(UNSCHEDULED_TAB).click();
    await expect.poll(() => headerStates(page, CATALOG)).toEqual([false, false]);
    await expect(page.locator(COLLAPSE_ALL)).toHaveAttribute('data-all-collapsed', 'true');

    // The same button expands them all.
    await page.locator(COLLAPSE_ALL).click();
    await expect.poll(() => headerStates(page, CATALOG)).toEqual([true, true]);
    expect(await cardCount(page, CATALOG)).toBeGreaterThan(0);

    // Collapse again, then load the tournament afresh: cleared.
    await page.locator(COLLAPSE_ALL).click();
    await expect.poll(() => headerStates(page, CATALOG)).toEqual([false, false]);
    // Leave for the tournament list and load the tournament again, in the app (a full page load would clear
    // memory anyway and prove nothing about the load-time reset).
    await page.evaluate(() => dev.tournamentContext.router?.navigate(`/tournaments/${Date.now()}`));
    await page.evaluate((id) => dev.tournamentContext.router?.navigate(`/tournament/${id}`), tournamentId);
    await page.waitForSelector('#tmxContent', { state: 'visible', timeout: 15_000 });
    await tournament.navigateToScheduling();
    await page.locator(UNSCHEDULED_TAB).click();
    await expect.poll(() => headerStates(page, CATALOG)).toEqual([true, true]);
  });

  test('Scheduled: collapse all, kept across pages, cleared on tournament load', async ({ page }) => {
    const tournamentId = await seed(page, { scheduleFirstRound: true });
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToScheduling();
    await page.locator(SCHEDULED_TAB).click();
    await expect.poll(async () => (await headerStates(page, SCHEDULED_PANEL)).length).toBeGreaterThan(0);

    await page.locator(COLLAPSE_ALL).click();
    await expect.poll(async () => (await headerStates(page, SCHEDULED_PANEL)).every((open) => !open)).toBe(true);
    expect(await cardCount(page, SCHEDULED_PANEL)).toBe(0);

    await tournament.navigateToEvents();
    await tournament.navigateToScheduling();
    await page.locator(SCHEDULED_TAB).click();
    await expect.poll(async () => (await headerStates(page, SCHEDULED_PANEL)).every((open) => !open)).toBe(true);
    expect(await cardCount(page, SCHEDULED_PANEL)).toBe(0);

    // Loading the tournament afresh, in the app, clears it.
    await page.evaluate(() => dev.tournamentContext.router?.navigate(`/tournaments/${Date.now()}`));
    await page.evaluate((id) => dev.tournamentContext.router?.navigate(`/tournament/${id}`), tournamentId);
    await page.waitForSelector('#tmxContent', { state: 'visible', timeout: 15_000 });
    await tournament.navigateToScheduling();
    await page.locator(SCHEDULED_TAB).click();
    await expect.poll(async () => (await headerStates(page, SCHEDULED_PANEL)).every((open) => open)).toBe(true);
    expect(await cardCount(page, SCHEDULED_PANEL)).toBeGreaterThan(0);
  });

  test('bottom strip: after the group-by select and before the card navigation, in the active toolbar', async ({
    page,
  }) => {
    await page.evaluate(() => localStorage.setItem('schedule2:catalog-placement', JSON.stringify('bottom')));
    const tournamentId = await seed(page, { scheduleFirstRound: false });
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToScheduling();
    await page.locator(UNSCHEDULED_TAB).click();

    const button = page.locator(`${CATALOG} .sp-catalog-toolbar ${COLLAPSE_ALL}, .tmx-catalog-tools ${COLLAPSE_ALL}`);
    await expect(button).toBeVisible();
    const order = await button.evaluate((el) =>
      Array.from(el.parentElement!.children).map((child) =>
        child === el
          ? 'button'
          : child.tagName === 'SELECT'
            ? 'select'
            : child.className.includes('spl-catalog-scroll')
              ? 'scroll'
              : 'other',
      ),
    );
    const at = order.indexOf('button');
    expect(order.lastIndexOf('select')).toBeLessThan(at);
    expect(order.indexOf('scroll')).toBeGreaterThan(at);

    await button.click();
    await expect.poll(() => headerStates(page, CATALOG)).toEqual([false, false]);
  });
});
