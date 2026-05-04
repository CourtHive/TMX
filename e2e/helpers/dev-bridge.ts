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

/**
 * Inject a synthetic super-admin JWT into localStorage so admin-gated
 * surfaces (Tournament Actions panel, super-admin-only pages) render
 * during e2e runs. The JWT is unsigned — `validateToken` uses
 * `jwtDecode` which does NOT verify the signature, so a base64-encoded
 * payload with the right claims is enough for the client.
 *
 * Must be called via `page.addInitScript` BEFORE the first navigation
 * so the token is in localStorage when TMX boots. Use the helper
 * `seedSuperAdminTokenInitScript` below for that wiring.
 */
export async function loginAsSuperAdmin(page: Page): Promise<void> {
  await page.evaluate(() => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(
      JSON.stringify({
        roles: ['superadmin'],
        sub: 'e2e-superadmin',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    );
    localStorage.setItem('tmxToken', `${header}.${payload}.fake-signature`);
  });
}

/**
 * Add an init script that seeds the super-admin token before any TMX
 * code runs. This is the right hook for tests where role-gated UI
 * needs to render correctly on the first paint.
 *
 * Call once in `test.beforeAll` (or before your first `page.goto`) —
 * Playwright re-runs init scripts on every navigation, so the token
 * stays present across `page.goto` calls within the same test.
 */
export async function seedSuperAdminTokenInitScript(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(
      JSON.stringify({
        roles: ['superadmin'],
        sub: 'e2e-superadmin',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    );
    localStorage.setItem('tmxToken', `${header}.${payload}.fake-signature`);
  });
}
