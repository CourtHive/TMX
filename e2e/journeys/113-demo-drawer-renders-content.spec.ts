import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';

/**
 * Journey 113 — a drawer given an ELEMENT must render it, not stringify it.
 *
 * Production defect (#1339 demo mode). `drawer.setContent`/`setFooter` accepted
 * `string | function`, and anything else fell through to `innerHTML = content`. An
 * HTMLElement stringifies to the literal text "[object HTMLDivElement]", which was then
 * rendered as the whole drawer body:
 *
 *   <div class="drawer__content">[object HTMLDivElement]</div>
 *
 * `demoModeDrawer` builds its content and footer as elements — every other drawer caller
 * passes a builder function — so it was the one that shipped broken. Nothing threw and
 * nothing logged: the drawer opened, was correctly sized and titled, and displayed a
 * string where the panel should have been.
 *
 * A vitest unit test would be the natural home for this, but TMX's unit suite runs in the
 * `node` environment and jsdom is deliberately not a dependency — DOM behaviour is covered
 * here, by the browser.
 *
 * Anonymous users are demo-eligible by design (`isDemoEligible` returns `!context.provider`
 * when there is no token), so this needs no login and no feature flag.
 */

const DRAWER_CONTENT = '.drawer__content';
const DRAWER_FOOTER = '.drawer__footer';

test('the demo-mode drawer renders its panel rather than "[object HTMLDivElement]"', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page); // anonymous — demo-eligible
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForAppReady(page);

  await page.locator('#login').click();
  await page.getByText('Demo mode…', { exact: true }).click();

  const content = page.locator(DRAWER_CONTENT);
  await content.waitFor({ state: 'visible', timeout: 10_000 });

  // The assertion that matters. Checking only "the panel exists" would pass against the
  // broken build too, because appending was never the failure — coercion was.
  await expect(content).not.toContainText('[object HTML');
  await expect(page.locator(DRAWER_FOOTER)).not.toContainText('[object HTML');

  // …and the real content is actually there, so "no [object]" cannot pass by the drawer
  // having rendered nothing at all.
  await expect(content.locator('.tmx-demo-panel')).toHaveCount(1);
  await expect(page.locator(`${DRAWER_FOOTER} button`).first()).toBeVisible();
});
