import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';
import { todayLocal } from '../helpers/dates';

/**
 * Journey 121 — the scheduling page's legend
 *
 * The page has grown a vocabulary nobody is told: rest badge states, the
 * daily-limit marker, the Inspector's provenance suffixes and "Could not read"
 * line, check-in counts, annotation pills. The footer's info icon opens a
 * legend for all of it.
 *
 * The unit test owns the CONTENT — that every mark has an entry, in the same
 * words the page uses. What only a browser can show is that the affordance is
 * reachable: the icon is in the footer, clicking it opens the popover, and the
 * popover is dismissible. A legend nobody can open is not an affordance.
 */

const LEGEND_BUTTON = 'button.tmx-legend-button';
const LEGEND = '.tmx-legend';

async function seedScheduledTournament(page: Page): Promise<string> {
  const today = todayLocal();
  return page.evaluate(async (date) => {
    await dev.tmx2db.initDB();
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      nonRandom: 1,
      setState: true,
      tournamentName: 'E2E Schedule Legend',
      tournamentAttributes: { tournamentId: 'e2e-schedule-legend', startDate: date, endDate: date },
      drawProfiles: [{ eventName: 'Legend Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
      venueProfiles: [{ courtsCount: 2, venueName: 'Legend Venue' }],
    });
    await dev.tmx2db.addTournament(dev.factory.tournamentEngine.getTournament().tournamentRecord);
    return tournamentRecord.tournamentId as string;
  }, today);
}

test.describe('Journey 121 — scheduling page legend', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('the footer info icon opens a legend of the page vocabulary', async ({ page }) => {
    const tournamentId = await seedScheduledTournament(page);
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToScheduling();

    const button = page.locator(LEGEND_BUTTON);
    await expect(button).toBeVisible();
    // Closed until asked for: an orientation affordance must not occupy the
    // page for the operators who already know the vocabulary.
    await expect(page.locator(LEGEND)).toHaveCount(0);

    await button.click();
    const legend = page.locator(LEGEND);
    await expect(legend).toBeVisible();

    // Spot-check the two ends of the content: the badge word an operator is
    // most likely to be puzzled by, and a section heading.
    await expect(legend).toContainText('on court');
    await expect(legend).toContainText('Rest badge');
    // Every row carries both halves; the unit test asserts this over the model,
    // this asserts the renderer actually emitted both.
    const rows = legend.locator('.tmx-legend-row');
    expect(await rows.count()).toBeGreaterThanOrEqual(9);
    await expect(rows.first().locator('.tmx-legend-meaning')).not.toBeEmpty();
  });

  test('the legend dismisses on an outside click', async ({ page }) => {
    const tournamentId = await seedScheduledTournament(page);
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToScheduling();

    await page.locator(LEGEND_BUTTON).click();
    await expect(page.locator(LEGEND)).toBeVisible();

    await page.mouse.click(5, 5);
    await expect(page.locator(LEGEND)).toBeHidden();
  });
});
