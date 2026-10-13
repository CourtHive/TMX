import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';

/**
 * Journey 159 — the Live Schedule example needs a usable competition clock.
 *
 * The example anchors its schedule on "now" at the competition. A failed competition clock gives no
 * instant, and generating the example used to throw (`toISOString()` on an invalid Date) instead of
 * refusing. It now skips that one example with an actionable message (third-party review, 2026-10-13).
 *
 * The control generates the same example with no competition clock installed, so the refusal case
 * cannot pass merely because the picker or the generator never ran.
 */

const ROW = '#tournamentsTable .tabulator-row';
const SPLASH = 'Generate Demo Tournaments';
const LIVE = 'Live Schedule';

async function generateLiveSchedule(page: Page): Promise<void> {
  await page.getByText(SPLASH).first().click();
  await page.getByText(LIVE, { exact: true }).first().click();
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
}

test.describe('Journey 159 — the Live Schedule example and the competition clock', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForAppReady(page);
    await initDevBridge(page);
    await expect(page.getByText(SPLASH).first()).toBeVisible({ timeout: 10_000 });
  });

  test('control: with no competition clock installed, the example is generated', async ({ page }) => {
    await generateLiveSchedule(page);
    await expect(page.locator(ROW).filter({ hasText: LIVE })).toHaveCount(1, { timeout: 15_000 });
  });

  test('with a failed competition clock it is skipped with a message, not a throw', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.evaluate(() =>
      dev.setCompetitionClock({
        nowMs: () => {
          throw new Error('demo control offline');
        },
      }),
    );

    await generateLiveSchedule(page);

    await expect(page.locator('body')).toContainText('The Live Schedule example was not generated', {
      timeout: 10_000,
    });
    await expect(page.locator(ROW).filter({ hasText: LIVE })).toHaveCount(0);
    expect(errors.filter((message) => /time value/i.test(message))).toEqual([]);

    await page.evaluate(() => dev.setCompetitionClock());
  });
});
