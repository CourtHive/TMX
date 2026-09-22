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
 * Journey 127 — the tournament INFORMATION publish (factory 7.0.0, punch list P23).
 *
 * The registration phase: events exist, no draws do. Before this publish a tournament in that state
 * could not be made public at all — every other publish needs a draw, a schedule or entries first — so
 * the fixture here deliberately has NO drawProfiles.
 *
 * Asserted: the panel renders with its own state badge and a scope selector listing the tournament's
 * events, and the tournament-level Unpublish button — disabled while nothing is published — becomes
 * enabled once information alone is published.
 *
 * The publish itself is applied through the factory engine rather than the toggle, for the reason
 * journey 71 documents: a locally-seeded tournament is unknown to the server, so a serverFirst
 * mutation would round-trip to nothing. The render path is the regression surface here.
 *
 * Requires the local CFS at SERVER (publishing is login-gated); skips cleanly when it is absent.
 */

const INFO_PANEL = 'xpath=//h3[contains(., "Tournament Information")]';
const INFO_TOGGLE =
  'xpath=//h3[contains(., "Tournament Information")]/following-sibling::div[contains(@class,"pub-toggle-row")]//label[contains(@class,"pub-toggle")]/input';
const INFO_BADGE =
  'xpath=//h3[contains(., "Tournament Information")]/following-sibling::div[contains(@class,"pub-toggle-row")]//span[contains(@class,"pub-state")]';
const UNPUBLISH_BUTTON = 'xpath=//button[contains(., "Unpublish Tournament")]';

const PROVIDER_ABBR = uniqueAbbr('I');
const PROVIDER_NAME = `E2E Info Publish ${uniqueSuffix()}`;

const DRAWLESS_TOURNAMENT = {
  tournamentName: 'E2E Registration Phase',
  tournamentAttributes: { tournamentId: 'e2e-registration-phase' },
  participantsProfile: { scaledParticipantsCount: 8 },
  eventProfiles: [{ eventName: 'Open Singles' }, { eventName: 'Open Doubles', eventType: 'DOUBLES' }],
  drawProfiles: [],
};

let seeded = false;
let token: string | null = null;
let providerId: string | undefined;

test.describe('Journey 127 — publishing tournament information', () => {
  test.beforeAll(async ({ request }) => {
    token = await signInSuperAdmin(request);
    if (!token) return undefined;
    providerId = await ensureProvider(request, token, PROVIDER_ABBR, PROVIDER_NAME);
    seeded = true;
  });

  test.afterAll(async ({ request }) => {
    if (!token) return undefined;
    await deleteProvider(request, token, providerId, PROVIDER_ABBR);
  });

  test('a tournament with no draws can be published, and its events are listed', async ({ page }) => {
    test.skip(!seeded, `CFS at ${SERVER} / bootstrap super-admin unavailable`);

    const auth = new AuthFlow(page);
    await auth.login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    await auth.selectProvider(PROVIDER_NAME);

    await initDevBridge(page);
    const tournamentId = await seedTournament(page, DRAWLESS_TOURNAMENT);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await page.locator('#b-route').click();

    // The panel exists and is usable — the control that did not exist before 7.0.0.
    await page.locator(INFO_PANEL).waitFor({ state: 'visible', timeout: 10_000 });
    const toggle = page.locator(INFO_TOGGLE);
    await toggle.waitFor({ state: 'attached', timeout: 10_000 });
    await expect(toggle).toBeEnabled();

    // Nothing is published yet: the badge reads off and the tournament-level unpublish is disabled.
    await expect(page.locator(INFO_BADGE)).toHaveClass(/pub-state-off/);
    await expect(page.locator(UNPUBLISH_BUTTON)).toBeDisabled();

    // The scope selector lists the tournament's events, so a director can choose which are listed. The
    // multi-select is a tag widget rather than a <select>, so read what it renders: every event is
    // selected by default, and each selection shows as a tag.
    const panel = page.locator(INFO_PANEL).locator('xpath=..');
    await expect(panel).toContainText('Open Singles');
    await expect(panel).toContainText('Open Doubles');

    // Publish information alone — no draw, no schedule, no participant list.
    const published = await page.evaluate(() => {
      const result = dev.factory.tournamentEngine.publishTournamentInfo();
      return {
        success: result?.success === true,
        rollUp: dev.factory.tournamentEngine.getPublishState()?.publishState?.tournament?.status?.published,
      };
    });
    expect(published.success).toBe(true);
    // control: the factory considers the tournament published on the information publish alone
    expect(published.rollUp).toBe(true);

    // Re-render the tab and read what the panel now says.
    await tournament.navigateToOverview();
    await page.locator('#b-route').click();
    await page.locator(INFO_PANEL).waitFor({ state: 'visible', timeout: 10_000 });

    await expect(page.locator(INFO_BADGE)).toHaveClass(/pub-state-live/);
    await expect(page.locator(UNPUBLISH_BUTTON)).toBeEnabled();
  });
});
