import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, PROFILE_DRAW_GENERATED } from '../helpers/seed';
import {
  SERVER,
  ensureProvider,
  uniqueSuffix,
  signInSuperAdmin,
  SUPERADMIN_EMAIL,
  SUPERADMIN_PASSWORD,
} from '../helpers/role-fixtures';
import { TournamentPage } from '../pages/TournamentPage';
import { AuthFlow } from '../pages/AuthFlow';

/**
 * Journey 73 — Chat indicator is login-gated.
 *
 * The tournament-nav chat icon (`#chatIndicator`) shows only when
 * `canUseChat && getLoginState()` (setupChatIndicator, navigation.ts) — chat is a
 * server interaction, so a locally-loaded tournament with no login has nothing to
 * talk to. Regression guard for the documented "chat icon vanished for logged-in
 * users" bug (silent-refresh re-eval). Logged-out is a pure local test; logged-in
 * uses a real CFS login (skips when CFS is absent).
 */

const CHAT = '#chatIndicator';
const PROVIDER_ABBR = 'TMXCHT';
const PROVIDER_NAME = `E2E Chat ${uniqueSuffix()}`;

let seeded = false;

test.describe('Journey 73 — chat indicator gating', () => {
  test.beforeAll(async ({ request }) => {
    const token = await signInSuperAdmin(request);
    if (!token) return;
    await ensureProvider(request, token, PROVIDER_ABBR, PROVIDER_NAME);
    seeded = true;
  });

  test('is hidden on a locally-loaded tournament with no login', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
    const tournamentId = await seedTournament(page, PROFILE_DRAW_GENERATED);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);

    await expect(page.locator(CHAT)).toBeHidden();
  });

  test('is shown for a logged-in user on a tournament', async ({ page }) => {
    test.skip(!seeded, `CFS at ${SERVER} / bootstrap super-admin unavailable`);

    const auth = new AuthFlow(page);
    await auth.login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    await auth.selectProvider(PROVIDER_NAME);

    // Seed + open a tournament (do NOT resetState after login — it clears the token).
    await initDevBridge(page);
    const tournamentId = await seedTournament(page, PROFILE_DRAW_GENERATED);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);

    await expect(page.locator(CHAT)).toBeVisible({ timeout: 10_000 });
  });
});
