import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';
import { seedTournament } from '../helpers/seed';

declare const dev: any;

/**
 * Journey 199 — the matchUps filter popover's chips (CA 2026-11-08). Type and Profile are chips, any combination
 * on; every chip on is "all"; with every chip on a click selects that chip alone, then clicks toggle; turning off
 * the last chip turns them all back on. A competitiveness bar segment selects exactly its profile, and the
 * popover's chips show it.
 */
const rowCount = async (page: Page) => {
  // the tab header: "Matches (22)", the rows the filters leave
  const text =
    (await page
      .getByText(/^Matches \(\d+\)$/)
      .first()
      .textContent()) ?? '';
  return Number(/\((\d+)\)/.exec(text)?.[1]);
};

test.describe('Journey 199 — matchUps filter chips', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('type and profile chips combine, reset, and follow the bar', async ({ page }) => {
    const tournamentId = await seedTournament(page, {
      tournamentAttributes: { tournamentId: 'e2e-matchups-filter-chips' },
      drawProfiles: [
        { eventName: 'Singles', drawSize: 16 },
        { eventName: 'Doubles', drawSize: 8, eventType: 'DOUBLES' },
      ],
      completeAllMatchUps: true,
    } as any);
    const { singles, doubles } = await page.evaluate(() => {
      const { matchUps } = dev.factory.tournamentEngine.allTournamentMatchUps();
      return {
        singles: matchUps.filter((m: any) => m.matchUpType === 'SINGLES').length,
        doubles: matchUps.filter((m: any) => m.matchUpType === 'DOUBLES').length,
      };
    });

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToMatchUps();
    await expect.poll(() => rowCount(page)).toBe(singles + doubles);

    await page.locator('#filterPopoverButton').click();
    const popover = page.locator('.tippy-box .filter-popover-chips');
    const chip = (group: string, label: string) =>
      page.locator(`.filter-popover-chips[aria-label="${group}"] .filter-popover-chip`, { hasText: label });

    // every chip on: no filter
    await expect(chip('Type', 'Singles')).toHaveAttribute('aria-pressed', 'true');
    await expect(chip('Type', 'Doubles')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.filter-popover-chips[aria-label="Profile"] .filter-popover-chip')).toHaveCount(4);
    // the popover fades in: capture once it is opaque, in both themes
    await expect
      .poll(() =>
        page
          .locator('.tippy-box')
          .last()
          .evaluate((box) => getComputedStyle(box).opacity),
      )
      .toBe('1');
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => document.documentElement.setAttribute('data-theme', theme), theme);
      await page.waitForTimeout(350);
      await page
        .locator('.tippy-box')
        .last()
        .screenshot({ path: test.info().outputPath(`chips-${theme}.png`) });
    }

    // every chip on: a click selects Singles alone
    await chip('Type', 'Singles').click();
    await expect(chip('Type', 'Singles')).toHaveAttribute('aria-pressed', 'true');
    await expect(chip('Type', 'Doubles')).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => rowCount(page)).toBe(singles);
    await page.waitForTimeout(150);
    await page
      .locator('.tippy-box')
      .last()
      .screenshot({ path: test.info().outputPath('chips-singles-only.png') });

    // the last chip off turns them all back on
    await chip('Type', 'Singles').click();
    await expect(chip('Type', 'Singles')).toHaveAttribute('aria-pressed', 'true');
    await expect(chip('Type', 'Doubles')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => rowCount(page)).toBe(singles + doubles);

    // profiles combine: Competitive alone, then Routine added
    await chip('Profile', 'Competitive').click();
    await chip('Profile', 'Routine').click();
    await expect(chip('Profile', 'Competitive')).toHaveAttribute('aria-pressed', 'true');
    await expect(chip('Profile', 'Routine')).toHaveAttribute('aria-pressed', 'true');
    await expect(chip('Profile', 'Decisive')).toHaveAttribute('aria-pressed', 'false');
    await expect(chip('Profile', 'Walkover')).toHaveAttribute('aria-pressed', 'false');
    expect(await rowCount(page)).toBeLessThanOrEqual(singles + doubles);
    await expect(page.locator('.tippy-box .filter-popover-row.is-filtering')).toHaveCount(1);

    // Clear All turns every chip back on
    await page.locator('.tippy-box button', { hasText: 'Clear All' }).click();
    await expect(page.locator('.tippy-box .filter-popover-chip[aria-pressed="false"]')).toHaveCount(0);
    await expect.poll(() => rowCount(page)).toBe(singles + doubles);
    await expect(popover.first()).toBeVisible();

    // a bar segment selects exactly its profile; the popover shows it
    await page.locator('.tippy-box .delete').click();
    await page.locator('.chc-cb__seg[data-bucket="COMPETITIVE"]').click();
    await page.locator('#filterPopoverButton').click();
    await expect(chip('Profile', 'Competitive')).toHaveAttribute('aria-pressed', 'true');
    await expect(chip('Profile', 'Routine')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.chc-cb__seg[data-bucket="COMPETITIVE"]')).toBeVisible();
  });
});
