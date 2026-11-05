import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';

/**
 * Journey 193 — the Settings tab shows the time where the tournament is played, bottom centre,
 * when the tournament's zone reads differently from the machine's.
 *
 * Administrators and provisioners audit tournaments in other zones; the clock orients them. The
 * browser is pinned to UTC, so a Tokyo tournament differs and a UTC tournament does not.
 */

const CLOCK = '#tournamentClock';

test.use({ timezoneId: 'UTC' });

async function openSettings(page: Page, localTimeZone: string): Promise<string> {
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);

  // Direct IDB write (journey 81's pattern) so the /settings goto isn't overridden by dev.load.
  const tournamentId = await page.evaluate(async (zone: string) => {
    await dev.tmx2db.initDB();
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      tournamentName: 'E2E Tournament Clock',
      tournamentAttributes: { localTimeZone: zone },
      nonRandom: 1,
      setState: true,
    });
    await dev.tmx2db.addTournament(tournamentRecord);
    return tournamentRecord.tournamentId as string;
  }, localTimeZone);

  await page.goto(`/#/tournament/${tournamentId}/settings`);
  await page.locator('#tournamentSettings .settings-panel').first().waitFor({ timeout: 15_000 });
  return tournamentId;
}

test.describe('Journey 193 — settings tournament-time clock', () => {
  test('shows the tournament zone clock and leaves with the Settings tab', async ({ page }) => {
    const tournamentId = await openSettings(page, 'Asia/Tokyo');

    const clock = page.locator(CLOCK);
    await expect(clock).toBeVisible();
    await expect(clock).toContainText('Asia/Tokyo');
    // The bar sits at the bottom of the viewport, centred.
    const box = await clock.boundingBox();
    const viewport = page.viewportSize()!;
    expect(Math.round(box!.y + box!.height)).toBe(viewport.height);

    await page.goto(`/#/tournament/${tournamentId}/overview`);
    await expect(clock).toHaveCount(0);
  });

  test('shows nothing when the tournament reads the machine clock', async ({ page }) => {
    await openSettings(page, 'UTC');
    await expect(page.locator('#tournamentSettings .settings-panel').first()).toBeVisible();
    // The clock mounts after layout; give it the same chance it had in the test above.
    await page.waitForTimeout(250);
    await expect(page.locator(CLOCK)).toHaveCount(0);
  });
});
