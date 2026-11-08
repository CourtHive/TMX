import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';

declare const dev: any;

/**
 * Journey 200 — the matchUps table's footer holds the status chips with counts (CA 2026-11-08): one click to
 * what is still to be played. A count is the rows its chip would show — every other filter applied, the status
 * chips not — and the popover's Status chips are the same filter.
 */
const rowCount = async (page: Page) => {
  const text =
    (await page
      .getByText(/^Matches \(\d+\)$/)
      .first()
      .textContent()) ?? '';
  return Number(/\((\d+)\)/.exec(text)?.[1]);
};

const strip = (page: Page) => page.locator('.tmx-status-strip');
const stripChip = (page: Page, value: string) => strip(page).locator(`.tmx-status-strip-chip[data-value="${value}"]`);
const counts = (page: Page) =>
  strip(page)
    .locator('.tmx-status-strip-count')
    .allTextContents()
    .then((values) => values.map(Number));

test.describe('Journey 200 — the status strip in the matchUps footer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('counts, one click to be played, combinations, and the popover agrees', async ({ page }) => {
    // a 16 draw: round 1 complete (8), one round-2 match live, one suspended, five still to be played
    const tournamentId = await page.evaluate(async () => {
      const { mocksEngine, tournamentEngine } = dev.factory;
      const {
        drawIds: [drawId],
      } = mocksEngine.generateTournamentRecord({
        tournamentAttributes: { tournamentId: 'e2e-matchups-status-strip' },
        drawProfiles: [{ drawSize: 16 }],
        nonRandom: 1,
        setState: true,
      });
      tournamentEngine.completeDrawMatchUps({ drawId, roundsToComplete: 1 });
      const [live, suspended] = tournamentEngine
        .allDrawMatchUps({ drawId })
        .matchUps.filter((m: any) => m.roundNumber === 2);
      const inProgress = mocksEngine.generateOutcomeFromScoreString({
        scoreString: '3-2',
        matchUpStatus: 'IN_PROGRESS',
      });
      tournamentEngine.setMatchUpStatus({ drawId, matchUpId: live.matchUpId, outcome: inProgress.outcome });
      tournamentEngine.setMatchUpStatus({
        drawId,
        matchUpId: suspended.matchUpId,
        outcome: { matchUpStatus: 'SUSPENDED' },
      });
      const { tournamentRecord } = tournamentEngine.getTournament();
      await dev.load(tournamentRecord);
      return tournamentRecord.tournamentId;
    });

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToMatchUps();
    await expect(strip(page)).toBeVisible();

    // to be played, live, suspended, complete; every chip on
    await expect.poll(() => counts(page)).toEqual([5, 1, 1, 8]);
    await expect(strip(page).locator('[aria-pressed="false"]')).toHaveCount(0);
    await expect.poll(() => rowCount(page)).toBe(15);
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => document.documentElement.setAttribute('data-theme', theme), theme);
      await page.waitForTimeout(350);
      await strip(page).screenshot({ path: test.info().outputPath(`strip-${theme}.png`) });
    }

    // one click: what is still to be played. The counts stay: they never apply the status chips
    await stripChip(page, 'toBePlayed').click();
    await expect.poll(() => rowCount(page)).toBe(5);
    await expect(stripChip(page, 'toBePlayed')).toHaveAttribute('aria-pressed', 'true');
    await expect(stripChip(page, 'complete')).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => counts(page)).toEqual([5, 1, 1, 8]);
    await expect(page.locator('#filterPopoverButton .filter-badge')).toBeVisible();
    await strip(page).screenshot({ path: test.info().outputPath('strip-to-be-played.png') });

    // and live with it
    await stripChip(page, 'live').click();
    await expect.poll(() => rowCount(page)).toBe(6);

    // the popover's Status chips are the same filter
    await page.locator('#filterPopoverButton').click();
    const statusChip = (label: string) =>
      page.locator('.filter-popover-chips[aria-label="Status"] .filter-popover-chip', { hasText: label });
    await expect(statusChip('To be played')).toHaveAttribute('aria-pressed', 'true');
    await expect(statusChip('Live')).toHaveAttribute('aria-pressed', 'true');
    await expect(statusChip('Complete')).toHaveAttribute('aria-pressed', 'false');

    // Clear All: every chip on, here and in the footer
    await page.locator('.tippy-box button', { hasText: 'Clear All' }).click();
    await expect(strip(page).locator('[aria-pressed="false"]')).toHaveCount(0);
    await expect.poll(() => rowCount(page)).toBe(15);

    // another filter changes the counts: Competitive alone keeps only completed, competitive matchUps
    const profileChip = page.locator('.filter-popover-chips[aria-label="Profile"] .filter-popover-chip', {
      hasText: 'Competitive',
    });
    await profileChip.click();
    const shown = await rowCount(page);
    await expect.poll(async () => (await counts(page)).reduce((sum, count) => sum + count, 0)).toBe(shown);
    await expect.poll(async () => (await counts(page))[0]).toBe(0);
  });
});
