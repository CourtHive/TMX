import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { seedTournament, PROFILE_WITH_VENUES } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 109 — "Add courts" must mint its own courtIds.
 *
 * Production defect, 2026-08-23 (CFS audit_log, tournament 6c637f87): an operator added two courts
 * to a venue, then renamed one 11 seconds later and got `ERR_NOT_FOUND_COURT` for a courtId the
 * server had never seen.
 *
 * `addCourts` lets the engine generate identifiers when none are supplied — and under server-first
 * the client REPLAYS the acknowledged mutation against its own factory instance, generating a
 * different UUID for the same court. The browser was left holding ids that existed nowhere else.
 * Measured directly against the factory: two runs of the same `addCourts` params without `courtIds`
 * produce different ids; with `courtIds` supplied, both runs agree.
 *
 * `addVenue.ts` had always passed explicit courtIds; the add-to-existing-venue path had not. This
 * pins that it does, by asserting the courts actually created carry the ids that were dispatched.
 */

const VENUE_ROW = '#venuesTable .tabulator-row';

async function gotoVenuesTable(page: Page) {
  const tournamentId = await seedTournament(page, PROFILE_WITH_VENUES);
  await page.evaluate(() => localStorage.setItem('tmx_venues_view_mode', 'table'));
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToVenues();
  await expect(page.locator(VENUE_ROW).first()).toBeVisible({ timeout: 10_000 });
}

/**
 * "Add courts" is a control-bar button on the venue's NESTED courts table, not an entry in the row's
 * ⋮ menu — so the venue row has to be expanded first.
 */
async function openAddCourtsDrawer(page: Page) {
  await page.locator(VENUE_ROW).first().locator('.tabulator-cell').nth(2).click();
  const addCourts = page.locator('#venuesTable .subTable button', { hasText: 'Add courts' }).first();
  await expect(addCourts).toBeVisible({ timeout: 10_000 });
  await addCourts.click();
}

test.describe('Journey 109 — venue add courts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('dispatches explicit courtIds and creates exactly those courts', async ({ page }) => {
    await gotoVenuesTable(page);
    const collector = createMutationCollector(page);

    const before = await page.evaluate(() => dev.factory.tournamentEngine.getVenuesAndCourts().courts.length);

    await openAddCourtsDrawer(page);

    const countField = page.locator('.drawer .field:has(label.label:text-is("Number of courts")) input').first();
    await expect(countField).toBeVisible({ timeout: 10_000 });
    await countField.fill('2');
    await countField.dispatchEvent('input');

    await page.locator('#addCourtsButton').click();

    await collector.waitForMethod('addCourts');

    const dispatched = collector
      .getMutations()
      .flatMap((m) => m.methods)
      .find((m) => m.method === 'addCourts');

    // The fix: the client decides the identifiers rather than leaving them to the engine.
    const courtIds = dispatched?.params?.courtIds as string[] | undefined;
    expect(Array.isArray(courtIds)).toBe(true);
    expect(courtIds).toHaveLength(2);
    expect(new Set(courtIds).size).toBe(2);

    // And the courts that exist afterwards are those exact ids — not a second, locally-minted set.
    await expect
      .poll(() => page.evaluate(() => dev.factory.tournamentEngine.getVenuesAndCourts().courts.length))
      .toBe(before + 2);

    const present = await page.evaluate(() =>
      dev.factory.tournamentEngine.getVenuesAndCourts().courts.map((c: any) => c.courtId),
    );
    for (const courtId of courtIds ?? []) expect(present).toContain(courtId);
  });
});
