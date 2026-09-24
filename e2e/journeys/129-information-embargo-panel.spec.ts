import { TournamentPage } from '../pages/TournamentPage';
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
 * Journey 129 — the information EMBARGO on the publishing tab (punch list P23, D4b).
 *
 * "Announce on a date." The publish is recorded immediately and every public reader withholds the
 * tournament until the embargo lifts — courthive-query's search gates on `visible_from`, and the CFS
 * `tournamentinfo` route returns not-found. This journey covers the half those cannot: that the panel
 * TELLS THE DIRECTOR the truth about a state where published and visible disagree.
 *
 * The state badge is the point. A tournament published with a pending embargo is published — the
 * toggle is on — and absent from every listing. Rendering that as `live` would be a lie the director
 * acts on; rendering it as `off` would invite them to publish something already published.
 *
 * Publishes through the factory engine rather than the toggle, for the reason journey 71 and 127
 * document: a locally-seeded tournament is unknown to the server, so a serverFirst mutation would
 * round-trip to nothing. The render path is the regression surface.
 *
 * Requires the local CFS at SERVER (publishing is login-gated); skips cleanly when it is absent.
 */

const INFO_PANEL = 'xpath=//h3[contains(., "Tournament Information")]';
// Scoped to the PANEL rather than to a sibling index: the panel's children are ordered for the
// reader (row first, then the explanatory note), and a selector pinned to `following-sibling::div[1]`
// silently stops finding the badge the moment that order changes — which it did, mid-build.
const INFO_BADGE = `${INFO_PANEL}/parent::div//span[contains(@class,"pub-state")]`;
const INFO_EMBARGO_BUTTON = `${INFO_PANEL}/parent::div//button[contains(@class,"pub-embargo-remove")]`;
const FUTURE = '2099-01-01T09:00:00Z';

const DRAWLESS_TOURNAMENT = {
  tournamentName: `E2E Info Embargo ${uniqueSuffix()}`,
  eventProfiles: [{ eventName: 'Open Singles' }, { eventName: 'Open Doubles', eventType: 'DOUBLES' }],
};

let seeded = false;
let providerId: string | undefined;
const PROVIDER_ABBR = uniqueAbbr();
const PROVIDER_NAME = `E2E Embargo Provider ${uniqueSuffix()}`;

test.describe('Journey 129 — the information embargo says so on the panel', () => {
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

  test('a published tournament withheld until a date reads as embargoed, not live', async ({ page }) => {
    test.skip(!seeded, `CFS at ${SERVER} / bootstrap super-admin unavailable`);

    const auth = new AuthFlow(page);
    await auth.login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    await auth.selectProvider(PROVIDER_NAME);

    await initDevBridge(page);
    const tournamentId = await seedTournament(page, DRAWLESS_TOURNAMENT);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await page.locator('#b-route').click();
    await page.locator(INFO_PANEL).waitFor({ state: 'visible', timeout: 10_000 });

    // Nothing published: off.
    await expect(page.locator(INFO_BADGE)).toHaveClass(/pub-state-off/);

    // The embargo control is offered WHILE UNPUBLISHED. Gating it on "published" would force a
    // director to publish first and embargo second, and the tournament is publicly visible in the
    // window between those two actions — which is the one thing an embargo exists to prevent.
    // Setting it publishes WITH the embargo, in one mutation.
    await expect(page.locator(INFO_EMBARGO_BUTTON)).toBeVisible();

    // Publish information WITH an embargo, then re-render the tab.
    const published = await page.evaluate((embargo) => {
      const result = dev.factory.tournamentEngine.publishTournamentInfo({ embargo });
      return {
        success: result?.success === true,
        published: dev.factory.tournamentEngine.getPublishState()?.publishState?.tournament?.status?.published,
        visibleFrom: dev.factory.publishingGovernor?.getTournamentVisibleFrom?.({
          tournamentRecord: dev.factory.tournamentEngine.getTournament()?.tournamentRecord,
        }),
      };
    }, FUTURE);

    expect(published.success).toBe(true);
    // The factory's two answers disagree, which is the state this panel has to render honestly.
    expect(published.published).toBe(true);
    expect(published.visibleFrom).toBe(FUTURE);

    // Re-render the tab by leaving and returning: clicking the route button alone re-renders from
    // state the tab already holds (journey 127 does the same for the same reason).
    await tournament.navigateToOverview();
    await page.locator('#b-route').click();
    await page.locator(INFO_PANEL).waitFor({ state: 'visible', timeout: 10_000 });

    // The badge says withheld — not live, and not off.
    await expect(page.locator(INFO_BADGE)).toHaveClass(/pub-state-embargoed/);

    // And the panel explains it in words, because a director looking at an enabled toggle and an
    // empty public site would otherwise conclude the publish had failed.
    const panel = page.locator(INFO_PANEL).locator('xpath=..');
    await expect(panel).toContainText('not listed publicly until');
  });
});
