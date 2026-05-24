import { test, expect, type Page } from '@playwright/test';
import { waitForAppReady } from '../helpers/dev-bridge';
import {
  SERVER,
  ROLE_PASSWORD,
  uniqueSuffix,
  removeUser,
  ensureProvider,
  createProvisioner,
  signInSuperAdmin,
  assignProvisionerRep,
  cleanupProvisioner,
  createLoginableUser,
  associateProviderToProvisioner,
} from '../helpers/role-fixtures';

/**
 * Journey 36 — provider switcher + admin gating (real server login).
 *
 * Validates the provisioner-admin-routing client work end-to-end: a real login
 * issues a JWT whose providerAssociations / provisionerProviders drive
 * `isActiveProviderAdmin()` (account-menu "Admin" item) and the provider
 * switcher. Token injection is NOT used — TMX's authenticated boot is
 * server-coupled, so the JWT must come from a genuine /auth/login (mirrors
 * journey 28's pattern).
 *
 * Seeds via the admin API as a super-admin; if that bootstrap account is
 * unavailable the whole journey skips (so it never red-fails CI on a missing
 * seed). Requires CFS at SERVER.
 */
const suffix = uniqueSuffix();
const PROVIDER_ADMIN_EMAIL = `e2e-tmx-padmin-${suffix}@courthive.test`;
const DIRECTOR_EMAIL = `e2e-tmx-director-${suffix}@courthive.test`;
const REP_EMAIL = `e2e-tmx-rep-${suffix}@courthive.test`;
const PROVISIONER_NAME = `E2E-TMX-Provisioner-${suffix}`;
const PROVIDER_NAME = 'E2E TMX Role Provider';

let token: string | null = null;
let seeded = false;
let providerId = '';
let provisionerId = '';

async function loginViaModal(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/');
  await waitForAppReady(page);
  await page.locator('#login').click();
  await page.getByText('Log in').click();
  await page.locator('input[placeholder*="email"]').fill(email);
  await page.locator('input[placeholder*="8 characters"]').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  // Sign-in + provider resolution are async; give the app a beat to settle
  // (matches journey 28). Subsequent assertions poll, so this is a floor.
  await page.waitForTimeout(1500);
}

test.describe('Journey 36 — provider switcher + admin gating (real login)', () => {
  test.beforeAll(async ({ request }) => {
    token = await signInSuperAdmin(request);
    if (!token) return; // seed admin unavailable → tests skip below

    providerId = await ensureProvider(request, token, 'TMXROLE', PROVIDER_NAME);
    await createLoginableUser(request, token, {
      email: PROVIDER_ADMIN_EMAIL,
      roles: ['client'],
      providerId,
      providerRole: 'PROVIDER_ADMIN',
    });
    await createLoginableUser(request, token, {
      email: DIRECTOR_EMAIL,
      roles: ['client'],
      providerId,
      providerRole: 'DIRECTOR',
    });
    await createLoginableUser(request, token, { email: REP_EMAIL, roles: ['client'] });
    provisionerId = await createProvisioner(request, token, PROVISIONER_NAME);
    await associateProviderToProvisioner(request, token, provisionerId, providerId);
    await assignProvisionerRep(request, token, provisionerId, REP_EMAIL);
    seeded = true;
  });

  test.afterAll(async ({ request }) => {
    if (!token) return;
    await cleanupProvisioner(request, token, provisionerId);
    await removeUser(request, token, PROVIDER_ADMIN_EMAIL);
    await removeUser(request, token, DIRECTOR_EMAIL);
    await removeUser(request, token, REP_EMAIL);
  });

  test('PROVIDER_ADMIN sees the Admin item in the account menu', async ({ page }) => {
    test.skip(!seeded, `seed unavailable (CFS at ${SERVER} / bootstrap super-admin)`);
    await loginViaModal(page, PROVIDER_ADMIN_EMAIL, ROLE_PASSWORD);
    await page.locator('#login').click();
    await expect(page.getByText('Admin', { exact: true })).toBeVisible();
  });

  test('a DIRECTOR does NOT see the Admin item', async ({ page }) => {
    test.skip(!seeded, `seed unavailable (CFS at ${SERVER} / bootstrap super-admin)`);
    await loginViaModal(page, DIRECTOR_EMAIL, ROLE_PASSWORD);
    await page.locator('#login').click();
    await expect(page.getByText('Log out', { exact: true })).toBeVisible(); // menu opened
    await expect(page.getByText('Admin', { exact: true })).toHaveCount(0);
  });

  test('a provisioner sees their managed provider in the switcher', async ({ page }) => {
    test.skip(!seeded, `seed unavailable (CFS at ${SERVER} / bootstrap super-admin)`);
    await loginViaModal(page, REP_EMAIL, ROLE_PASSWORD);
    // Login lands on /tournaments; the provider badge opens the switcher, which
    // offers the provisioner-managed provider (validates the server emits
    // provisionerProviders and TMX consumes them).
    await page.locator('#provider').click();
    await expect(page.getByText(PROVIDER_NAME)).toBeVisible();
  });
});
