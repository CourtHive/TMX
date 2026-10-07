import { test, expect, type Page } from '@playwright/test';
import { waitForAppReady } from '../helpers/dev-bridge';
import { routeApiToCfs } from '../helpers/cfsProxy';
import {
  createLoginableUser,
  signInSuperAdmin,
  ensureProvider,
  deleteProvider,
  ROLE_PASSWORD,
  uniqueSuffix,
  uniqueAbbr,
  removeUser,
  SERVER,
} from '../helpers/role-fixtures';

/**
 * Journey 136 — a user with more than one provider CHOOSES one at login, and works only in it.
 *
 * CA, 2026-10-06 (Mentat/planning/MULTI_PROVIDER_CONTEXT_COMPLETION.md):
 *   - "if they are associated with multiple providers they aren't automatically associated with one";
 *   - login answers with the providers, "the UI will then know to prompt for specification of the provider
 *     and another round-trip gets the user's configuration/token";
 *   - the picker preselects the last pick; the user confirms;
 *   - to work in the other provider they "must switch first".
 *
 * Real login against CFS (SERVER): the session token comes from /auth/select-provider, and the server refuses
 * work outside the provider the token was issued for.
 */

const suffix = uniqueSuffix();
const ABBR_A = uniqueAbbr('MA');
const ABBR_B = uniqueAbbr('MB');
const NAME_A = `E2E Multi Alpha ${suffix}`;
const NAME_B = `E2E Multi Beta ${suffix}`;
const email = `e2e-multi-provider-${suffix}@courthive.test`;

let adminToken: string | null = null;
let providerA: string | undefined;
let providerB: string | undefined;
let seeded = false;

const decode = (token: string) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
const storedToken = (page: Page) => page.evaluate(() => localStorage.getItem('tmxToken'));

async function submitLogin(page: Page): Promise<void> {
  await routeApiToCfs(page);
  await page.goto('/');
  await waitForAppReady(page);
  await page.locator('#login').click();
  await page.getByText('Log in').click();
  await page.locator('input[placeholder*="email"]').fill(email);
  await page.locator('input[placeholder*="8 characters"]').fill(ROLE_PASSWORD);
  await page.locator('#loginButton').click();
}

test.describe('Journey 136 — a multi-provider user chooses a provider at login', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ request }) => {
    adminToken = await signInSuperAdmin(request);
    if (!adminToken) return;
    providerA = await ensureProvider(request, adminToken, ABBR_A, NAME_A);
    providerB = await ensureProvider(request, adminToken, ABBR_B, NAME_B);
    await createLoginableUser(request, adminToken, {
      email,
      roles: ['client'],
      providerId: providerA,
      providerRole: 'PROVIDER_ADMIN',
    });
    // the second association, as a super-admin
    const users = await (
      await request.post(`${SERVER}/auth/allusers`, { headers: { Authorization: `Bearer ${adminToken}` } })
    ).json();
    const list = users?.users ?? users ?? [];
    const userId =
      list.find?.((u: any) => (u.email ?? u.value?.email) === email)?.userId ??
      list.find?.((u: any) => u.value?.email === email)?.value?.userId;
    const assoc = await request.put(`${SERVER}/provisioner/users/${userId}/providers/${providerB}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { providerRole: 'PROVIDER_ADMIN' },
    });
    seeded = !!(providerA && providerB && userId && assoc.ok());
  });

  test.afterAll(async ({ request }) => {
    if (!adminToken) return;
    await removeUser(request, adminToken, email);
    await deleteProvider(request, adminToken, providerA, ABBR_A);
    await deleteProvider(request, adminToken, providerB, ABBR_B);
  });

  test('login asks which provider; nothing loads until one is chosen; the session is for the chosen one', async ({
    page,
    request,
  }) => {
    test.skip(!seeded, `seed unavailable (CFS at ${SERVER} / bootstrap super-admin)`);
    await submitLogin(page);

    // the picker, and no session yet: the login did not place them in either provider
    await expect(page.getByText('Choose a provider')).toBeVisible({ timeout: 10_000 });
    expect(await storedToken(page)).toBeNull();
    const select = page.locator('.modal select, [role="dialog"] select').last();
    await expect(select.locator('option', { hasText: NAME_A })).toHaveCount(1);
    await expect(select.locator('option', { hasText: NAME_B })).toHaveCount(1);

    await select.selectOption(providerB as string);
    await page.locator('#chooseProviderContinue').click();

    // a session for B, and the app shows B
    await expect
      .poll(async () => (await storedToken(page)) && decode((await storedToken(page)) as string).providerId)
      .toBe(providerB);
    await expect(page.locator('#provider')).toContainText(ABBR_B, { timeout: 10_000 });

    // the server holds the session to B: saving into A is refused, into B accepted
    const token = (await storedToken(page)) as string;
    const save = (organisationId: string, tag: string) =>
      request.post(`${SERVER}/factory/save`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          tournamentRecord: {
            tournamentId: `e2e-136-${tag}-${suffix}`,
            tournamentName: `E2E 136 ${tag}`,
            startDate: '2026-11-01',
            endDate: '2026-11-02',
            parentOrganisation: { organisationId },
          },
        },
      });
    const intoB = await save(providerB as string, 'b');
    const intoBBody = await intoB.json().catch(() => ({}));
    expect(intoBBody?.success, `save into B: ${intoB.status()} ${JSON.stringify(intoBBody).slice(0, 300)}`).toBe(true);
    const intoA = await save(providerA as string, 'a');
    expect((await intoA.json())?.error, 'save into A, the provider this session is NOT for').toBe('User not allowed');
  });

  test('the picker preselects the last pick, and switching issues a session for the other provider', async ({
    page,
  }) => {
    test.skip(!seeded, `seed unavailable (CFS at ${SERVER} / bootstrap super-admin)`);
    await submitLogin(page);

    // B was chosen last time: preselected, the user still confirms
    await expect(page.getByText('Choose a provider')).toBeVisible({ timeout: 10_000 });
    const select = page.locator('.modal select, [role="dialog"] select').last();
    await expect(select).toHaveValue(providerB as string);
    await page.locator('#chooseProviderContinue').click();
    await expect(page.locator('#provider')).toContainText(ABBR_B, { timeout: 10_000 });

    // switch to A from the navbar badge: a NEW session, for A
    await page.locator('#provider').click();
    await page.getByText(NAME_A, { exact: true }).click();
    await expect
      .poll(async () => (await storedToken(page)) && decode((await storedToken(page)) as string).providerId, {
        timeout: 10_000,
      })
      .toBe(providerA);
    await expect(page.locator('#provider')).toContainText(ABBR_A, { timeout: 10_000 });
  });
});
