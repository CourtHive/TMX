import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';

/**
 * Journey 114 — the demo-mode drawer (#1339).
 *
 * Demo mode simulates a lockdown posture entirely client-side, so a demonstrator can show
 * what a restricted provider sees without touching the server. That makes its own UI the
 * only thing standing between a demo and a misleading one, and none of it was covered.
 *
 * Reached from the avatar menu. Anonymous users are demo-eligible by design —
 * `isDemoEligible()` returns `!context.provider` when there is no token — so no login or
 * feature flag is needed here.
 *
 * What is asserted, and why each earns its place:
 *
 *  - The drawer RENDERS. It shipped to production showing the literal string
 *    "[object HTMLDivElement]" because `drawer.setContent` stringified the element it was
 *    given. Nothing threw; the drawer opened and looked structurally fine.
 *  - Choosing a preset SURVIVES the re-render. Selecting one closes and reopens the whole
 *    drawer (`rerender()`), so "the radio is checked" is a genuine round trip through
 *    sessionStorage, not a DOM echo of the click.
 *  - Ticking a capability flips the posture to `custom`. The preset picker is documented as
 *    setting the checkboxes and then getting out of the way — this is the assertion that it
 *    never became a second code path.
 *  - Exit CLEARS the overlay. A posture outliving the demo is the one failure that follows
 *    the user out of the drawer and misrepresents the product afterwards.
 *
 * State is read from `sessionStorage` rather than from the DOM wherever possible: the DOM
 * is what the code just wrote, the storage is what the next page load will believe.
 */

const OVERLAY_KEY = 'tmx_demo_overlay';
const DRAWER_CONTENT = '.drawer__content';
const PRESET_ROW = '.tmx-demo-preset';
const CAP_ROW = '.tmx-demo-row';

async function openDemoDrawer(page: Page): Promise<void> {
  await page.locator('#login').click();
  await page.getByText('Demo mode…', { exact: true }).click();
  await page.locator(`${DRAWER_CONTENT} .tmx-demo-panel`).waitFor({ state: 'visible', timeout: 10_000 });
}

async function overlay(page: Page): Promise<any> {
  return page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, OVERLAY_KEY);
}

test.beforeEach(async ({ page }) => {
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
});

test('the drawer renders its panel, not a stringified element', async ({ page }) => {
  await openDemoDrawer(page);

  const content = page.locator(DRAWER_CONTENT);
  // The regression that reached production. Asserting only "the panel exists" would pass
  // against the broken build — appending was never the failure, coercion was.
  await expect(content).not.toContainText('[object HTML');

  await expect(content.locator('.tmx-demo-warning')).toContainText('Client-side simulation only');
  await expect(content.locator(PRESET_ROW)).toHaveCount(6);
  expect(await content.locator(CAP_ROW).count()).toBeGreaterThan(10);
  await expect(page.locator('.drawer__footer button')).toHaveText('Exit demo mode');
});

test('choosing a posture stores an overlay that survives the drawer re-rendering itself', async ({ page }) => {
  await openDemoDrawer(page);
  expect(await overlay(page), 'no posture is simulated until one is chosen').toBeNull();

  await page.getByText('Scoring only (Recorder)', { exact: true }).click();
  await page.locator(`${DRAWER_CONTENT} .tmx-demo-panel`).waitFor({ state: 'visible' });

  const stored = await overlay(page);
  expect(stored?.preset).toBe('recorder');
  expect(Object.keys(stored?.permissions ?? {}).length, 'the preset confers permissions').toBeGreaterThan(0);

  // Selecting a preset CLOSES AND REOPENS the drawer. If the radio is still checked after
  // that, the state genuinely round-tripped through storage rather than the click merely
  // having ticked a box that was about to be thrown away.
  const recorderRadio = page.locator(PRESET_ROW).filter({ hasText: 'Scoring only (Recorder)' }).locator('input');
  await expect(recorderRadio).toBeChecked();
});

test('returning to provider defaults clears the simulation', async ({ page }) => {
  await openDemoDrawer(page);
  await page.getByText('Scoring only (Recorder)', { exact: true }).click();
  await page.locator(`${DRAWER_CONTENT} .tmx-demo-panel`).waitFor({ state: 'visible' });
  expect(await overlay(page)).not.toBeNull(); // the control: something to clear

  await page.getByText('Provider defaults (no simulation)', { exact: true }).click();
  await page.locator(`${DRAWER_CONTENT} .tmx-demo-panel`).waitFor({ state: 'visible' });

  expect(await overlay(page), 'provider defaults means NO overlay, not an empty one').toBeNull();
});

test('ticking a capability flips the posture to custom', async ({ page }) => {
  await openDemoDrawer(page);
  await page.getByText('Tournament director', { exact: true }).click();
  await page.locator(`${DRAWER_CONTENT} .tmx-demo-panel`).waitFor({ state: 'visible' });
  expect((await overlay(page))?.preset).toBe('director');

  // The preset picker is documented as setting the checkboxes and then being done. Editing
  // one afterwards must leave the posture describing itself honestly, rather than still
  // claiming to be the preset it no longer matches.
  const firstCap = page.locator(CAP_ROW).first().locator('input[type="checkbox"]');
  const wasChecked = await firstCap.isChecked();
  await firstCap.click();

  const stored = await overlay(page);
  expect(stored?.preset).toBe('custom');
  expect(await firstCap.isChecked()).toBe(!wasChecked);
});

test('exiting clears the overlay and closes the drawer', async ({ page }) => {
  await openDemoDrawer(page);
  await page.getByText('Registration desk', { exact: true }).click();
  await page.locator(`${DRAWER_CONTENT} .tmx-demo-panel`).waitFor({ state: 'visible' });
  expect(await overlay(page), 'the control — there is a posture to exit from').not.toBeNull();

  await page.locator('.drawer__footer button').click();

  // A posture that outlives the demo is the failure that follows the user out of the
  // drawer and misrepresents the product afterwards.
  expect(await overlay(page)).toBeNull();

  // `close()` hides the drawer — it removes the visible class after a ~350ms teardown
  // rather than emptying `.drawer__content`. So the panel stays in the DOM and the
  // assertion is about VISIBILITY. Asserting a count of 0 fails against correct
  // behaviour, which is how this was written first.
  await expect(page.locator(`${DRAWER_CONTENT} .tmx-demo-panel`)).toBeHidden();
});
