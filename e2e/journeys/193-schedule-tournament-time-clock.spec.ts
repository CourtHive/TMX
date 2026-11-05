import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';

/**
 * Journey 193 — the Schedule tab shows the time where the tournament is played, bottom centre,
 * when the tournament's zone reads differently from the machine's.
 *
 * Administrators and provisioners audit tournaments in other zones; the clock orients them. The
 * browser is pinned to UTC, so a Tokyo tournament differs and a UTC tournament does not.
 */

const CLOCK = '#tournamentClock';

test.use({ timezoneId: 'UTC' });

async function openSchedule(page: Page, localTimeZone: string): Promise<string> {
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);

  // Direct IDB write (journey 81's pattern) so the /scheduling goto isn't overridden by dev.load.
  const tournamentId = await page.evaluate(async (zone: string) => {
    await dev.tmx2db.initDB();
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      tournamentName: 'E2E Tournament Clock',
      tournamentAttributes: { localTimeZone: zone },
      drawProfiles: [{ eventName: 'Singles', drawSize: 8 }],
      venueProfiles: [{ venueName: 'Centre', courtsCount: 4 }],
      nonRandom: 1,
      setState: true,
    });
    await dev.tmx2db.addTournament(tournamentRecord);
    return tournamentRecord.tournamentId as string;
  }, localTimeZone);

  await page.goto(`/#/tournament/${tournamentId}/scheduling`);
  await page.locator('#schedulingContainer > *').first().waitFor({ timeout: 15_000 });
  return tournamentId;
}

test.describe('Journey 193 — schedule tournament-time clock', () => {
  test('shows the tournament zone clock, briefly, and leaves with the Schedule tab', async ({ page }) => {
    const tournamentId = await openSchedule(page, 'Asia/Tokyo');

    const clock = page.locator(CLOCK);
    await expect(clock).toBeVisible();
    await expect(clock).toContainText('Tokyo');
    expect(await clock.textContent()).not.toContain('Asia/');
    await expect(clock).toHaveAttribute('title', /Asia\/Tokyo/);
    // Docked in the bottom bar, centred.
    const box = (await clock.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.y + box.height).toBeGreaterThan(viewport.height - 60);
    expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(viewport.width / 4);

    // Every mode docks it in a bar that is on screen (Profile's bar used to sit below the fold).
    for (const mode of ['grid', 'profile', 'availability']) {
      await page.goto(`/#/tournament/${tournamentId}/scheduling/today/${mode}`);
      await expect(clock, mode).toBeInViewport({ ratio: 1 });
    }

    await page.goto(`/#/tournament/${tournamentId}/overview`);
    await expect(clock).toHaveCount(0);
  });

  test('shows nothing when the tournament reads the machine clock', async ({ page }) => {
    await openSchedule(page, 'UTC');
    // The clock mounts after layout; give it the same chance it had in the test above.
    await page.waitForTimeout(250);
    await expect(page.locator(CLOCK)).toHaveCount(0);
  });
});
