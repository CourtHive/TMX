import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';

/**
 * Journey 124 — a demo posture must take effect the moment it is chosen.
 *
 * Journey 114 covers what the drawer STORES and journey 117 covers the route guard. Neither
 * covers the gap between them: what the rest of the chrome does at the instant the posture
 * changes, with no navigation in between. Three failures lived in that gap.
 *
 *  - **The drawer dismissed itself.** `rerender()` called `drawer.close()` and then reopened,
 *    so choosing a posture played a ~350ms close animation followed by an open one. Journey
 *    114 asserted the radio survived that round trip, which it did — the round trip was the
 *    bug, not a property worth preserving.
 *  - **The nav rail kept the previous posture.** `applyTabCapabilityVisibility` was reached
 *    only from `highlightTab`/`tmxNavigation`, i.e. on a tab render. Choosing a posture
 *    renders no tab, so denied icons stayed clickable until the user happened to navigate —
 *    and then the router bounced them with a toast, which is the guard doing its job late.
 *  - **Exit was worse.** Leaving demo mode also renders no tab, so the restricted icon set
 *    stayed on screen with none of the hidden icons available to click to trigger the render
 *    that would have restored them.
 *
 * Asserted WITHOUT navigating, deliberately: any `page.goto` re-renders a tab and re-applies
 * visibility, which is exactly what masked all three.
 */

const DRAWER = '#tmxDrawer';
const PANEL = '.drawer__content .tmx-demo-panel';
const EVENTS_ICON = '#e-route';
const VENUES_ICON = '#v-route';
const MATCHUPS_ICON = '#m-route';

async function bootWithTournament(page: Page): Promise<void> {
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page); // anonymous — demo-eligible
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await waitForAppReady(page);

  const tournamentId = await page.evaluate(async () => {
    await dev.tmx2db.initDB();
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      nonRandom: 1,
      setState: true,
      tournamentName: 'E2E Demo Posture',
      drawProfiles: [{ eventName: 'Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
    });
    await dev.tmx2db.addTournament(tournamentRecord);
    return tournamentRecord.tournamentId as string;
  });

  await page.goto(`/#/tournament/${tournamentId}`);
  await page.locator(EVENTS_ICON).waitFor({ state: 'visible', timeout: 15_000 });
}

async function openDemoDrawer(page: Page): Promise<void> {
  await page.locator('#login').click();
  await page.getByText('Demo mode…', { exact: true }).click();
  await page.locator(PANEL).waitFor({ state: 'visible', timeout: 10_000 });
}

/**
 * Record every time the drawer loses `is-visible`. `close()` removes that class synchronously
 * and only tears down `is-active` 350ms later, so polling for a hidden drawer would race the
 * animation and pass against the broken build. Observing the class is exact.
 */
async function watchForDrawerClose(page: Page): Promise<void> {
  await page.evaluate((selector) => {
    const target = document.querySelector(selector);
    if (!target) return;
    (globalThis as any).__drawerCloses = 0;
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const was = (record.oldValue ?? '').includes('is-visible');
        const now = (record.target as HTMLElement).classList.contains('is-visible');
        if (was && !now) (globalThis as any).__drawerCloses += 1;
      }
    });
    observer.observe(target, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  }, DRAWER);
}

const drawerCloses = (page: Page) => page.evaluate(() => (globalThis as any).__drawerCloses ?? 0);

test('choosing a posture updates the drawer in place instead of dismissing it', async ({ page }) => {
  await bootWithTournament(page);
  await openDemoDrawer(page);
  await watchForDrawerClose(page);

  await page.getByText('Read only', { exact: true }).click();
  await expect(page.locator(PANEL)).toBeVisible();

  // The radio still reflects the stored posture — the property journey 114 pinned — but now
  // without the drawer having gone away and come back to prove it.
  const readOnlyRadio = page.locator('.tmx-demo-preset').filter({ hasText: 'Read only' }).locator('input');
  await expect(readOnlyRadio).toBeChecked();

  expect(await drawerCloses(page), 'the drawer must not close when a posture is chosen').toBe(0);
});

test('a restricted posture hides denied nav icons immediately, with no navigation', async ({ page }) => {
  await bootWithTournament(page);

  // The control. Without it, "the icon is hidden" would also pass against a nav rail that
  // never rendered.
  await expect(page.locator(EVENTS_ICON)).toBeVisible();
  await expect(page.locator(VENUES_ICON)).toBeVisible();

  await openDemoDrawer(page);
  await page.getByText('Read only', { exact: true }).click();
  await expect(page.locator(PANEL)).toBeVisible();

  await expect(page.locator(EVENTS_ICON)).toBeHidden();
  await expect(page.locator(VENUES_ICON)).toBeHidden();

  // Read-useful sections survive every posture — a hidden-everything rail would satisfy the
  // assertions above without the derivation being right.
  await expect(page.locator(MATCHUPS_ICON)).toBeVisible();
});

test('exiting demo mode restores the full nav rail, with no navigation', async ({ page }) => {
  await bootWithTournament(page);
  await openDemoDrawer(page);
  await page.getByText('Read only', { exact: true }).click();
  await expect(page.locator(EVENTS_ICON)).toBeHidden(); // the control: something to restore

  await page.locator('.drawer__footer button').click();

  // The icons must come back on the Exit click itself. Before the fix they returned only on
  // the next tab render, and the icons that would have triggered one were the hidden ones.
  await expect(page.locator(EVENTS_ICON)).toBeVisible();
  await expect(page.locator(VENUES_ICON)).toBeVisible();
});
