import type { Page } from '@playwright/test';

/**
 * Initialize the dev bridge on a page.
 *
 * Enables mutation logging via dev.context({ internal: true }) and
 * optionally injects a page.exposeFunction bridge for structured
 * mutation capture (Phase 2+).
 *
 * Must be called after page.goto() since the dev object is created
 * during tmxReady() in initialState.ts.
 */
export async function initDevBridge(page: Page): Promise<void> {
  // Wait for the dev object to be available (set during tmxReady)
  await page.waitForFunction(() => typeof globalThis.dev !== 'undefined', null, { timeout: 15_000 });

  // Enable mutation logging to console
  await page.evaluate(() => {
    dev.context({ internal: true });
  });
}

/**
 * Reset the TMX database and clear state for a clean test run.
 */
export async function resetState(page: Page): Promise<void> {
  await page.evaluate(() => dev.tmx2db.resetDB());
}

/**
 * Wait for the app to be fully ready (splash dismissed, navbar visible).
 *
 * TMX starts with an animated splash screen that dismisses on click,
 * then shows either the welcome view (no tournaments) or the calendar.
 * #tmxContent starts display:none and only becomes visible when a
 * tournament is opened — so we wait for the navbar instead.
 */
export async function waitForAppReady(page: Page): Promise<void> {
  // Dismiss the splash if it's showing (click anywhere)
  const splash = page.locator('#splash');
  if (await splash.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await splash.click();
  }

  // Wait for the navbar (#dnav) — it's always visible once the app is ready
  await page.waitForSelector('#dnav', { state: 'visible', timeout: 15_000 });
}

/**
 * Check whether the dev object is available on the page.
 */
export async function isDevAvailable(page: Page): Promise<boolean> {
  return page.evaluate(() => typeof globalThis.dev !== 'undefined');
}
