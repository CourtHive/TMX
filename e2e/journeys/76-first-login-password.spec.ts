import { test, expect } from '@playwright/test';
import {
  SERVER,
  removeUser,
  ROLE_PASSWORD,
  uniqueSuffix,
  signInSuperAdmin,
} from '../helpers/role-fixtures';
import { AuthFlow } from '../pages/AuthFlow';

/**
 * Journey 76 — forced first-login password change.
 *
 * A freshly admin-created user (whose first-login clear was NOT run) logs in and
 * /auth/login returns `{ mustChangePassword: true, limitedToken }` instead of a
 * session JWT — TMX must block on the firstLoginPasswordModal before the app is
 * usable. role-fixtures already handles this at the API layer; nothing validated
 * the TMX UI actually gates on it. Real CFS login; skips when CFS is absent.
 */

const NEW_PASSWORD_INPUT = '#firstLoginNewPassword';
const email = `e2e-firstlogin-${uniqueSuffix()}@courthive.test`;

let seeded = false;
let token: string | null = null;

test.describe('Journey 76 — forced first-login password change', () => {
  test.beforeAll(async ({ request }) => {
    token = await signInSuperAdmin(request);
    if (!token) return;
    // Create the user but do NOT complete first-login, so the account is left in
    // the mustChangePassword state.
    const res = await request.post(`${SERVER}/auth/admin-create-user`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { email, password: ROLE_PASSWORD, roles: [] },
    });
    seeded = res.ok();
  });

  test.afterAll(async ({ request }) => {
    // The account is deliberately left in the mustChangePassword state, so it is
    // not reusable by a later run — and it accumulated one row per run.
    if (token) await removeUser(request, token, email);
  });

  test('logging in as a first-login user forces the password-change modal', async ({ page }) => {
    test.skip(!seeded, `CFS at ${SERVER} / bootstrap super-admin unavailable`);

    const auth = new AuthFlow(page);
    await auth.login(email, ROLE_PASSWORD);

    // The app must surface the forced password-change modal (not a usable session).
    await expect(page.locator(NEW_PASSWORD_INPUT)).toBeVisible({ timeout: 10_000 });
  });
});
