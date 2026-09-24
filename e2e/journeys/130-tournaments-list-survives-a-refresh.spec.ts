import { initDevBridge } from '../helpers/dev-bridge';
import { seedTournament } from '../helpers/seed';
import { test, expect } from '@playwright/test';
import { AuthFlow } from '../pages/AuthFlow';
import {
  SERVER,
  ensureProvider,
  deleteProvider,
  uniqueSuffix,
  uniqueAbbr,
  signInSuperAdmin,
  SUPERADMIN_EMAIL,
  SUPERADMIN_PASSWORD,
} from '../helpers/role-fixtures';

/**
 * Journey 130 — a logged-in director's UNPUBLISHED tournaments survive a page refresh.
 *
 * Reported 2026-09-24 and reproduced before fixing: on a cold load the tournaments list showed the
 * "Welcome to TMX" splash, and navigating away and back made it work again. The list chose its feed
 * on `getUserContext()`, a synchronous read of a cache only `/auth/me` fills, filled
 * fire-and-forget at boot. On a refresh it was undefined, so the page took the LOGGED-OUT branch
 * and asked the public provider calendar — which is published-only by design. A director's own
 * unpublished tournaments vanished, which reads as data loss rather than as a feed choice.
 *
 * Instrumented rather than inferred: the cold load issued `provider/calendar` and never
 * `provider/my-calendars`.
 *
 * The fix asks `getLoginState()` instead — JWT validated locally, synchronous, no race — which is
 * what `settingsGrid` concluded for the same hazard after #1218/#1370.
 *
 * The seeded tournament is deliberately UNPUBLISHED: a published one is visible through either
 * feed, so it could not fail. Requires the local CFS at SERVER; skips cleanly when absent.
 */

const ROW = '#tournamentsTable .tabulator-row';
const SPLASH = 'Generate Demo Tournaments';

let seeded = false;
let providerId: string | undefined;
const PROVIDER_ABBR = uniqueAbbr();
const PROVIDER_NAME = `E2E Refresh Provider ${uniqueSuffix()}`;
const TOURNAMENT_NAME = `E2E Refresh Survivor ${uniqueSuffix()}`;

test.describe('Journey 130 — the tournaments list survives a refresh', () => {
  test.beforeAll(async ({ request }) => {
    const token = await signInSuperAdmin(request).catch(() => null);
    if (!token) return;
    providerId = await ensureProvider(request, token, PROVIDER_ABBR, PROVIDER_NAME);
    seeded = true;
  });

  test.afterAll(async ({ request }) => {
    if (!seeded) return;
    const token = await signInSuperAdmin(request).catch(() => null);
    if (token) await deleteProvider(request, token, providerId, PROVIDER_ABBR).catch(() => undefined);
  });

  test('an unpublished tournament is still listed after a cold page load', async ({ page }) => {
    test.skip(!seeded, `CFS at ${SERVER} / bootstrap super-admin unavailable`);

    const calls: string[] = [];
    page.on('request', (r) => {
      const url = r.url();
      if (url.includes('/provider/calendar') || url.includes('/provider/my-calendars')) {
        calls.push(url.includes('my-calendars') ? 'my-calendars' : 'public-calendar');
      }
    });

    const auth = new AuthFlow(page);
    await auth.login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    await auth.selectProvider(PROVIDER_NAME);
    await initDevBridge(page);

    await seedTournament(page, { tournamentName: TOURNAMENT_NAME, eventProfiles: [{ eventName: 'Open Singles' }] });
    await page.evaluate(() => dev.tournamentContext.router?.navigate(`/tournaments/${Date.now()}`));
    await expect(page.locator(ROW).filter({ hasText: TOURNAMENT_NAME })).toHaveCount(1);

    // THE STEP THAT BROKE IT: a refresh, with the list as the landing route.
    calls.length = 0;
    await page.reload();

    // Still there. Before the fix this was the splash, and stayed the splash.
    await expect(page.locator(ROW).filter({ hasText: TOURNAMENT_NAME })).toHaveCount(1, { timeout: 15_000 });
    await expect(page.locator('body')).not.toContainText(SPLASH);

    // …and it came from the OPERATOR feed. Asserted because the row alone cannot tell you which
    // feed served it, and a published tournament would arrive through either.
    expect(calls, `cold load issued: ${calls.join(', ') || '(none)'}`).toContain('my-calendars');
    expect(calls).not.toContain('public-calendar');
  });
});
