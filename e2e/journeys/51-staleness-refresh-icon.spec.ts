/**
 * Journey 51 — Staleness refresh icon
 *
 * When the local copy falls behind the server (detected by the lightweight
 * updated-at probe on reconnect / poll), TMX surfaces the navbar sync icon
 * instead of pulling the whole record in the background. The icon is the only
 * affordance that triggers a full-record fetch — and only on click.
 *
 * This journey drives the stale state deterministically via `dev.forceStaleness()`
 * (equivalent to the probe deciding the server is ahead) and mocks the
 * `/factory/fetch` endpoint so the click-to-refresh path runs without a live
 * server. It verifies:
 *   - the icon is hidden until stale, then shown,
 *   - while stale, `isStale()` is true (mutations are blocked — see mutationRequest),
 *   - clicking the icon pulls the full record (one /factory/fetch) and hides the icon,
 *   - the background poll never pulls the full record (no /factory/fetch without a click).
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { PROFILE_DRAW_GENERATED, seedTournament } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

test.describe('Journey 51 — staleness refresh icon', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('stale → icon shown, mutations blocked, click pulls fresh record', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_DRAW_GENERATED);

    const icon = page.locator(S.SYNC_INDICATOR);
    await expect(icon).toBeHidden();
    expect(await page.evaluate(() => dev.isStale())).toBe(false);

    // Count full-record fetches and serve a fresh record when one is requested.
    let fetchCalls = 0;
    await page.route('**/factory/fetch', async (route) => {
      fetchCalls += 1;
      const record = await page.evaluate(() => dev.getTournament());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tournamentRecords: { [tournamentId]: record } }),
      });
    });

    // Enter the stale state (what the probe does when the server is ahead).
    await page.evaluate(() => dev.forceStaleness());

    // Icon is shown and the guard reports stale → mutationRequest will block.
    await expect(icon).toBeVisible();
    expect(await page.evaluate(() => dev.isStale())).toBe(true);

    // Merely entering the stale state must NOT pull the full record.
    expect(fetchCalls).toBe(0);

    // Click the icon → exactly one full-record fetch, icon hidden, no longer stale.
    await icon.click();
    await expect(icon).toBeHidden();
    await expect.poll(() => fetchCalls).toBe(1);
    expect(await page.evaluate(() => dev.isStale())).toBe(false);
  });

  test('forceStaleness is idempotent and clears after refresh', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_DRAW_GENERATED);
    const icon = page.locator(S.SYNC_INDICATOR);

    await page.route('**/factory/fetch', async (route) => {
      const record = await page.evaluate(() => dev.getTournament());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tournamentRecords: { [tournamentId]: record } }),
      });
    });

    // Two stale signals before any click — still one icon, still stale.
    await page.evaluate(() => {
      dev.forceStaleness();
      dev.forceStaleness();
    });
    await expect(icon).toBeVisible();
    expect(await page.evaluate(() => dev.isStale())).toBe(true);

    // Refresh clears the stale state; a fresh signal can re-arm it.
    await icon.click();
    await expect(icon).toBeHidden();
    expect(await page.evaluate(() => dev.isStale())).toBe(false);

    await page.evaluate(() => dev.forceStaleness());
    await expect(icon).toBeVisible();
    expect(await page.evaluate(() => dev.isStale())).toBe(true);
  });

  // A tab change is not a refresh. It used to clear the stale flag along with the icon, so a desk that changed tabs
  // could write on a copy known to be behind until the next probe noticed again.
  test('a tab change keeps the copy stale: the icon stays and writes stay blocked', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_DRAW_GENERATED);
    const tournament = new TournamentPage(page);
    const icon = page.locator(S.SYNC_INDICATOR);
    let fetchCalls = 0;
    await page.route('**/factory/fetch', async (route) => {
      fetchCalls += 1;
      const record = await page.evaluate(() => dev.getTournament());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tournamentRecords: { [tournamentId]: record } }),
      });
    });

    await tournament.goto(tournamentId);
    await page.evaluate(() => dev.forceStaleness());
    await expect(icon).toBeVisible();

    await tournament.navigateToParticipants();
    await expect(page).toHaveURL(/participants/);
    await expect(icon).toBeVisible();
    expect(await page.evaluate(() => dev.isStale())).toBe(true);
    expect(fetchCalls).toBe(0);

    await icon.click();
    await expect(icon).toBeHidden();
    expect(fetchCalls).toBe(1);
  });

  // The Check-In workspace recovers on its own (option B): arriving there with a stale copy and nothing in progress
  // pulls the record, rather than waiting for a signal the probe will not send while the copy is already stale.
  test('opening the check-in desk with a stale copy catches up without a click', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_DRAW_GENERATED);
    const tournament = new TournamentPage(page);
    const icon = page.locator(S.SYNC_INDICATOR);
    let fetchCalls = 0;
    await page.route('**/factory/fetch', async (route) => {
      fetchCalls += 1;
      const record = await page.evaluate(() => dev.getTournament());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tournamentRecords: { [tournamentId]: record } }),
      });
    });

    await tournament.goto(tournamentId);
    await page.evaluate(() => dev.forceStaleness());
    await expect(icon).toBeVisible();

    await tournament.navigateToScheduling();
    await page.getByRole('button', { name: 'Check-In', exact: true }).click();
    await expect.poll(() => fetchCalls).toBe(1);
    await expect(icon).toBeHidden();
    expect(await page.evaluate(() => dev.isStale())).toBe(false);
  });
});
