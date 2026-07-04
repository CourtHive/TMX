import { test, expect, type Page } from '@playwright/test';
import { waitForAppReady } from '../helpers/dev-bridge';
import {
  SERVER,
  ensureProvider,
  uniqueSuffix,
  signInSuperAdmin,
  SUPERADMIN_EMAIL,
  SUPERADMIN_PASSWORD,
} from '../helpers/role-fixtures';

/**
 * Journey 58 — super-admin provider switch: persist + branding (real login).
 *
 * Regression guard for two coupled bugs fixed together:
 *
 *   1. Selecting/switching provider as a super-admin surfaced a red
 *      "Not authorised for that provider" toast. The fire-and-forget
 *      `PATCH /auth/me/last-selected-provider` was rejected because the server
 *      validated the target against the caller's own `user_providers`
 *      associations without exempting super-admins (whose impersonation is
 *      out-of-band of their associations). The controller now passes
 *      `isSuperAdmin` and the service bypasses the association check. The
 *      endpoint returns `{ error }` as a 200 body, so we assert on the body.
 *
 *   2. Switching to a provider that defines no navbar branding left the prior
 *      provider's label in the badge (the "switch to BOBOCA still shows
 *      INTENNSE" bug). `updateNavbarBranding` now rebuilds deterministically and
 *      falls back to the active provider's abbreviation instead of 'TMX', and
 *      `getLoginState` no longer re-applies the JWT provider config over an
 *      active impersonation. A brandless provider therefore shows its own
 *      abbreviation, and a subsequent switch replaces it.
 *
 * Real login (not token injection) — the JWT's superadmin role drives the
 * switcher and the persist authz path. Seeds two brandless providers via the
 * admin API as a super-admin; if that bootstrap account is unavailable the
 * whole journey skips (never red-fails CI on a missing seed). Requires CFS at
 * SERVER.
 */
const suffix = uniqueSuffix();
const PROVIDER_A_ABBR = 'TMXSWA';
const PROVIDER_B_ABBR = 'TMXSWB';
const PROVIDER_A_NAME = `E2E Switch Alpha ${suffix}`;
const PROVIDER_B_NAME = `E2E Switch Beta ${suffix}`;
const PATCH_LAST_SELECTED = '/auth/me/last-selected-provider';

let token: string | null = null;
let seeded = false;

async function loginViaModal(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/');
  await waitForAppReady(page);
  await page.locator('#login').click();
  await page.getByText('Log in').click();
  await page.locator('input[placeholder*="email"]').fill(email);
  await page.locator('input[placeholder*="8 characters"]').fill(password);
  await page.locator('#loginButton').click();
  // Sign-in + provider resolution are async; give the app a beat to settle
  // (matches journey 36). Subsequent assertions poll, so this is a floor.
  await page.waitForTimeout(1500);
}

async function openSwitcherAndSelect(page: Page, providerName: string): Promise<void> {
  // The navbar badge opens the super-admin switcher on /tournaments.
  await page.locator('#provider').click();
  // Item reads "Select provider…" before a pick, "Switch provider…" after one.
  await page.getByText(/(Select|Switch) provider/).click();
  const input = page.locator('input[placeholder="Type provider name"]');
  await input.click();
  await input.fill(providerName);
  // Awesomplete populates suggestions on input; click the match so the
  // type-ahead callback fires with the provider's organisationId (which is
  // what enables the Select button — typing the name alone does not).
  await page.locator('ul[role="listbox"] li', { hasText: providerName }).first().click();
  await page.locator('#selectButton').click();
}

test.describe('Journey 58 — super-admin provider switch (real login)', () => {
  test.beforeAll(async ({ request }) => {
    token = await signInSuperAdmin(request);
    if (!token) return; // seed admin unavailable → tests skip below
    await ensureProvider(request, token, PROVIDER_A_ABBR, PROVIDER_A_NAME);
    await ensureProvider(request, token, PROVIDER_B_ABBR, PROVIDER_B_NAME);
    seeded = true;
  });

  test('selecting a provider persists without an authorisation error and shows its abbreviation', async ({ page }) => {
    test.skip(!seeded, `seed unavailable (CFS at ${SERVER} / bootstrap super-admin)`);
    await loginViaModal(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);

    const patchPromise = page.waitForResponse(
      (r) => r.url().includes(PATCH_LAST_SELECTED) && r.request().method() === 'PATCH',
    );
    await openSwitcherAndSelect(page, PROVIDER_A_NAME);

    // Bug 1: the super-admin persist must NOT be rejected. The endpoint returns
    // `{ error }` as a 200 body, so assert on the parsed body, not the status.
    const patchResp = await patchPromise;
    const body: any = await patchResp.json().catch(() => ({}));
    expect(body.error).toBeFalsy();

    // Bug 2: a brandless provider shows its own abbreviation (not 'TMX').
    await expect(page.locator('#provider')).toContainText(PROVIDER_A_ABBR);
    // And no "Not authorised for that provider" danger toast was raised.
    await expect(page.locator('.notification.is-danger')).toHaveCount(0);
  });

  test('switching to a second provider replaces the badge (no stale branding)', async ({ page }) => {
    test.skip(!seeded, `seed unavailable (CFS at ${SERVER} / bootstrap super-admin)`);
    await loginViaModal(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);

    await openSwitcherAndSelect(page, PROVIDER_A_NAME);
    await expect(page.locator('#provider')).toContainText(PROVIDER_A_ABBR);

    await openSwitcherAndSelect(page, PROVIDER_B_NAME);
    await expect(page.locator('#provider')).toContainText(PROVIDER_B_ABBR);
    // The prior provider's label must not linger after the switch.
    await expect(page.locator('#provider')).not.toContainText(PROVIDER_A_ABBR);
  });
});
