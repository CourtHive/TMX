import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 78 — Schedule grid footer: order-of-play publish toggle.
 *
 * The grid action bar (bottom strip) carries a two-state publish pill for the
 * currently-viewed date, right of the Call Timing shortcut:
 *
 *   - not published → muted "Not published" (`.spl-publish-pill`)
 *   - published     → green, glowing "Published" (`.spl-publish-pill--on`)
 *
 * Clicking it opens a confirm dialog; confirming drives the SAME mutation path
 * as the publishing tab's per-date chips (`publishOrderOfPlay` /
 * `unPublishOrderOfPlay`). This journey pins that contract end to end:
 *
 *  - A freshly-seeded tournament starts on "Not published".
 *  - Publish → confirm → `publishOrderOfPlay` fires with the viewed date, the
 *    pill flips to the glowing published state, and the date-selector button
 *    grows its green published dot.
 *  - Unpublish the only published date → confirm → `unPublishOrderOfPlay`
 *    fires and the pill returns to "Not published".
 *
 * The pill lives in DOM the node vitest suite can't exercise; the pure toggle
 * logic (which methods, which dates) is unit-tested in
 * `services/publishing/orderOfPlayPublish.test.ts`. jsdom/happy-dom are not
 * introduced — Playwright is this ecosystem's single DOM test layer.
 */

const SCHEDULE_DATE = new Date().toISOString().slice(0, 10);

const PUBLISH_PILL = 'button.spl-publish-pill';
const PUBLISH_PILL_ON = 'button.spl-publish-pill.spl-publish-pill--on';
const PUBLISHED_DOT = '[title="Order of play published"]';
const OK_BUTTON = { role: 'button' as const, name: 'Ok' };

/**
 * Seed an 8-draw SE event on the schedule date with a venue so the grid view
 * mounts with its action bar. No scheduling needed — the publish pill toggles
 * the date's order-of-play publish status, independent of placed matchUps.
 *
 * Bundled into one page.evaluate so the IDB write can't race the seed helper's
 * fire-and-forget load (same gotcha Journey 29/38 document).
 */
async function seedTournament(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(async (date: string) => {
    try {
      await dev.tmx2db.initDB();

      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        tournamentName: 'E2E Footer Publish',
        tournamentAttributes: {
          tournamentId: 'e2e-footer-publish',
          startDate: date,
          endDate: date,
        },
        participantsProfile: { scaledParticipantsCount: 8 },
        drawProfiles: [{ eventName: 'Singles', drawSize: 8, seedsCount: 2, drawType: 'SINGLE_ELIMINATION' }],
        venueProfiles: [{ courtsCount: 2, venueName: 'Footer Publish Venue' }],
      });

      await dev.tmx2db.addTournament(dev.factory.tournamentEngine.getTournament().tournamentRecord);
      return tournamentRecord.tournamentId as string;
    } catch (err: any) {
      throw new Error(`${err?.name || 'Error'}: ${err?.message || String(err)}`);
    }
  }, SCHEDULE_DATE);
}

test.describe('Journey 78 — schedule footer publish toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('publish then unpublish the viewed date from the footer pill', async ({ page }) => {
    const tournamentId = await seedTournament(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToScheduling();

    const pill = page.locator(PUBLISH_PILL);
    await expect(pill).toBeVisible();
    // Fresh tournament: order of play unpublished.
    await expect(pill).toHaveText(/Not published/);
    await expect(page.locator(PUBLISH_PILL_ON)).toHaveCount(0);
    await expect(page.locator(PUBLISHED_DOT)).toHaveCount(0);

    // ── Publish ──────────────────────────────────────────────────────────
    const collector = createMutationCollector(page);
    await pill.click();
    await page.getByRole(OK_BUTTON.role, { name: OK_BUTTON.name }).click();

    const publishMutation = await collector.waitForMethod('publishOrderOfPlay');
    const publishMethod = publishMutation.methods.find((m) => m.method === 'publishOrderOfPlay');
    expect((publishMethod?.params as any)?.scheduledDates).toContain(SCHEDULE_DATE);

    // Pill flips to the glowing published state; the date-selector button grows
    // its green published dot (the selector recomputes via onMutationApplied).
    await expect(page.locator(PUBLISH_PILL_ON)).toHaveCount(1);
    await expect(page.locator(PUBLISH_PILL)).toHaveText(/^Published/);
    await expect(page.locator(PUBLISHED_DOT).first()).toBeVisible();

    // ── Unpublish (removing the only published date) ─────────────────────
    collector.clear();
    await page.locator(PUBLISH_PILL).click();
    await page.getByRole(OK_BUTTON.role, { name: OK_BUTTON.name }).click();

    await collector.waitForMethod('unPublishOrderOfPlay');

    await expect(page.locator(PUBLISH_PILL_ON)).toHaveCount(0);
    await expect(page.locator(PUBLISH_PILL)).toHaveText(/Not published/);
    await expect(page.locator(PUBLISHED_DOT)).toHaveCount(0);

    collector.detach();
  });
});
