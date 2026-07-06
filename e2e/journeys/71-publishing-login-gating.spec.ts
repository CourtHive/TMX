import { test, expect } from '@playwright/test';
import { initDevBridge } from '../helpers/dev-bridge';
import { seedTournament, PROFILE_R1_COMPLETE } from '../helpers/seed';
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
 * Journey 71 — Publishing is login-gated.
 *
 * The publishing panel shows "Log in to manage publishing" and disables its
 * controls until the user is authenticated (a real, server-validated login — a
 * client token alone does not unlock it). This asserts the gate flips: a
 * super-admin real login enables the Participants publish toggle. Requires the
 * local CFS at SERVER; skips cleanly when it is absent (role-fixtures pattern).
 *
 * The publish *mutation* itself is out of scope here (serverFirst would round-trip
 * a locally-seeded tournament the server doesn't know) — the auth gate is the
 * regression surface. The toggle DOM: `label.pub-toggle > input` under the
 * "Participants" h3.
 */

const PART_TOGGLE =
  'xpath=//h3[contains(., "Participants")]/following-sibling::div[contains(@class,"pub-toggle-row")]//label[contains(@class,"pub-toggle")]/input';

const PROVIDER_ABBR = 'TMXPUB';
const PROVIDER_NAME = `E2E Publish ${uniqueSuffix()}`;

let seeded = false;

test.describe('Journey 71 — publishing login gating', () => {
  test.beforeAll(async ({ request }) => {
    const token = await signInSuperAdmin(request);
    if (!token) return;
    await ensureProvider(request, token, PROVIDER_ABBR, PROVIDER_NAME);
    seeded = true;
  });

  test('a real login + active provider unlocks the publishing controls', async ({ page }) => {
    test.skip(!seeded, `CFS at ${SERVER} / bootstrap super-admin unavailable`);

    const auth = new AuthFlow(page);
    await auth.login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    // Publishing gates on login AND an active provider — select one.
    await auth.selectProvider(PROVIDER_NAME);

    // Seed + open a tournament to publish. Do NOT resetState here — it clears
    // the auth token and logs the user back out.
    await initDevBridge(page);
    const tournamentId = await seedTournament(page, PROFILE_R1_COMPLETE);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await page.locator('#b-route').click();

    // Unlocked: no "Log in to manage publishing" gate, and the Participants
    // publish toggle is present + enabled.
    await expect(page.getByText('Log in to manage publishing')).toHaveCount(0, { timeout: 10_000 });
    const toggle = page.locator(PART_TOGGLE);
    await toggle.waitFor({ state: 'attached', timeout: 10_000 });
    await expect(toggle).toBeEnabled();
  });
});
