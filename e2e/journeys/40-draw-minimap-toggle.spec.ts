/**
 * Journey 40 — Bracket minimap navigator + show/hide toggle
 *
 * Verifies:
 *   - A SINGLE_ELIMINATION draw with enough rounds (drawSize >= 32, i.e. 5+
 *     rounds) renders the .chc-minimap navigator on initial draw view.
 *   - The fa-table-columns toggle in the draw control bar's LEFT slot
 *     hides the minimap when clicked, and restores it on a second click.
 *   - The preference round-trips through localStorage (a second seed +
 *     navigate within the same browser context still respects the user's
 *     hidden state until they re-enable it).
 */
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { test, expect } from '@playwright/test';
import { S } from '../helpers/selectors';

const SE_64_PROFILE: MockProfile = {
  tournamentName: 'E2E Minimap',
  tournamentAttributes: { tournamentId: 'e2e-minimap' },
  participantsProfile: { scaledParticipantsCount: 64 },
  drawProfiles: [{ eventName: 'Singles', drawSize: 64, drawType: 'SINGLE_ELIMINATION' }],
  completeAllMatchUps: false,
};

const MINIMAP_SELECTOR = '.chc-minimap';
const TOGGLE_SELECTOR = '#drawMinimapToggle';

async function seedAndOpenDraw(page: any): Promise<void> {
  const tournamentId = await seedTournament(page, SE_64_PROFILE);
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToEvents();
  await page.locator(`${S.EVENTS_TABLE} .tabulator-row`).first().click();
  await expect(page.locator(S.DRAW_FRAME)).toBeVisible({ timeout: 10_000 });
}

test.describe('Journey 40 — Bracket minimap toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('minimap renders on a 64-draw SE and the toggle hides / restores it', async ({ page }) => {
    await seedAndOpenDraw(page);

    const minimap = page.locator(MINIMAP_SELECTOR);
    const toggle = page.locator(TOGGLE_SELECTOR);

    await expect(minimap).toBeVisible({ timeout: 5_000 });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await toggle.click();
    await expect(minimap).toHaveCount(0, { timeout: 5_000 });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await toggle.click();
    await expect(minimap).toBeVisible({ timeout: 5_000 });
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  test('hidden preference persists across a fresh seed within the same context', async ({ page }) => {
    await seedAndOpenDraw(page);

    const toggle = page.locator(TOGGLE_SELECTOR);
    await toggle.click();
    await expect(page.locator(MINIMAP_SELECTOR)).toHaveCount(0, { timeout: 5_000 });

    // Re-seed + re-navigate; the preference should survive.
    await resetState(page);
    await seedAndOpenDraw(page);

    await expect(page.locator(TOGGLE_SELECTOR)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator(MINIMAP_SELECTOR)).toHaveCount(0);
  });
});
