import { SERVER, signInSuperAdmin, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD } from '../helpers/role-fixtures';
import { routeApiToCfs } from '../helpers/cfsProxy';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';
import { test, expect, type Page } from '@playwright/test';
import { seedTournament } from '../helpers/seed';
import { AuthFlow } from '../pages/AuthFlow';

/**
 * Journey 103 — the app shell covers the viewport on every tab
 *
 * `#root` is a direct child of `body` and had no height rule anywhere on the
 * chain `#root → .app_shell → #navMain → #tmxContent → .tournament_container →
 * .tab_section → .section`. `body { height: 100vh }` painted the full viewport
 * while `#root` stayed content-sized, so any tab shorter than the window left a
 * strip of bare body background below its last element.
 *
 * That hole stayed invisible until three unrelated sizing strategies started
 * falling through it — a hard-coded `calc(100vh - 140px)` on the scheduling
 * workspace, a `calc(100vh - 200px)` cap on the reports table, and the
 * `.section { min-height: 1000px }` anti-jump hack. Reported 2026-08-22 as a
 * 45px gap under the schedule action bar (body 1200 / `#root` 1155). Measured
 * before the fix, at 1620x1200: overview 148px, participants 30px, events 29px,
 * matchUps 30px, scheduling 44px, reports 254px, publishing 46px.
 *
 * The assertion is deliberately about the SHELL, not about any one tab's chrome
 * arithmetic: `#root` must reach the bottom of the viewport whatever the tab
 * renders. A tab taller than the viewport is fine — that scrolls — so the check
 * is one-sided, and a strip of bare background is what it forbids.
 */

const TALL_VIEWPORT = { width: 1620, height: 1200 };

/**
 * Every tab reachable from the tournament nav, with the anchor that proves it
 * actually rendered. Measuring without the anchor is how a probe reports a
 * number for a tab that never painted.
 */
const TABS = [
  { name: 'overview', route: 'o-route', anchor: '#overview' },
  { name: 'participants', route: 'p-route', anchor: '#tournamentParticipants' },
  { name: 'events', route: 'e-route', anchor: '#eventsTable' },
  { name: 'matchUps', route: 'm-route', anchor: '#tournamentMatchUps' },
  { name: 'scheduling', route: 's2-route', anchor: '#schedulingContainer' },
  { name: 'venues', route: 'v-route', anchor: '#venuesTable' },
  { name: 'reports', route: 'r-route', anchor: '#tournamentReports' },
  { name: 'publishing', route: 'b-route', anchor: '#tournamentPublishing' },
];

/** Bottom-edge shortfall of `#root` against the viewport, in CSS pixels. */
async function shellShortfall(page: Page): Promise<number> {
  return page.evaluate(() => {
    const root = document.getElementById('root');
    if (!root) throw new Error('#root missing');
    // getBoundingClientRect().bottom rather than offsetHeight: it measures where
    // the element actually ENDS in the viewport, which is the thing the eye
    // reads as a gap. A short `#root` that started above the fold would pass an
    // offsetHeight check and still leave a visible strip.
    return globalThis.innerHeight - root.getBoundingClientRect().bottom;
  });
}

test.describe('Journey 103 — the app shell fills the viewport', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(TALL_VIEWPORT);
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('no tab leaves a strip of bare body background below #root', async ({ page }) => {
    const tournamentId = await seedTournament(page, {
      tournamentName: 'Shell Height Probe',
      drawProfiles: [{ eventName: 'Main Singles', drawSize: 16, completionGoal: 4 }],
      venueProfiles: [{ courtsCount: 6, venueName: 'Center Courts' }],
      participantsProfile: { scaledParticipantsCount: 16 },
    });

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);

    const shortfalls: Record<string, number> = {};

    for (const tab of TABS) {
      await page.locator(`#${tab.route}`).click();
      await page.waitForSelector(tab.anchor, { state: 'visible', timeout: 15_000 });
      // Tables and the scheduling grid mount asynchronously; a measurement taken
      // mid-mount reads a pre-layout height and would pass or fail for reasons
      // unrelated to the CSS under test.
      await page.waitForTimeout(1000);
      shortfalls[tab.name] = await shellShortfall(page);
    }

    // Report every tab before asserting — a bare `expect` that throws on the
    // first failure hides which of the sizing strategies is still short.
    console.log('shell shortfall by tab (px):', JSON.stringify(shortfalls));

    for (const [name, shortfall] of Object.entries(shortfalls)) {
      expect(shortfall, `${name}: #root stops ${shortfall}px above the viewport bottom`).toBeLessThanOrEqual(1);
    }
  });

  // Registrations is the one tab the nav cannot reach without a real login:
  // `canManageRegistrations` needs an open `registrationProfile` AND provider-admin
  // authority. Its table is the third place that guessed at chrome
  // (`calc(100vh - 280px)`), so it needs the same proof as the other two — which
  // means logging in against a live CFS rather than reasoning about it.
  test('the registrations table fills the workspace (CFS-gated)', async ({ page, request }) => {
    const reachable = !!(await signInSuperAdmin(request));
    test.skip(!reachable, `CFS at ${SERVER} / bootstrap super-admin unavailable`);

    // Under TEST_PROD the built app calls its own origin, and `vite preview` has
    // no API behind it — the login below would 404 and leave no session, hiding
    // the very nav icon this test asserts on. See cfsProxy for the full why.
    await routeApiToCfs(page);

    // Rows come from the declarations service (:3120), whose player surface is
    // HiveID-guarded — minting one of those tokens is a whole identity chain for
    // what is a geometry check. Stubbing the read exercises the real render path
    // with real rows instead, and keeps the probe independent of whether that
    // service happens to be running.
    await page.route('**/registrations?*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          Array.from({ length: 40 }, (_, i) => ({
            declarationId: `decl-${i}`,
            personId: `person-${i}`,
            providerId: 'E2E',
            tournamentId: 'e2e-shell-registrations',
            status: 'SUBMITTED',
            payload: { eventIds: ['main'], applicant: { givenName: `Applicant${i}`, familyName: 'Probe' } },
            updatedAt: '2026-08-23T00:00:00.000Z',
          })),
        ),
      }),
    );

    const auth = new AuthFlow(page);
    await auth.login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    await initDevBridge(page);

    const tournamentId = await page.evaluate(async () => {
      await dev.tmx2db.initDB();
      dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        tournamentName: 'Shell Height Probe — Registrations',
        tournamentAttributes: { tournamentId: 'e2e-shell-registrations' },
        drawProfiles: [{ eventName: 'Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
      });
      const rec = dev.factory.tournamentEngine.getTournament().tournamentRecord;
      // Gate one of canManageRegistrations — without it the nav icon stays hidden.
      rec.registrationProfile = { entriesOpen: new Date().toISOString() };
      // `resolveProvider()` reads this; without it the tab toasts "no provider"
      // and never fetches, which would leave an empty table passing a geometry
      // check for the wrong reason.
      rec.parentOrganisation = { organisationId: 'E2E', organisationName: 'E2E Provider' };
      dev.factory.tournamentEngine.setState(rec);
      await dev.tmx2db.addTournament(rec);
      return rec.tournamentId as string;
    });

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await expect(page.locator('#rg-route')).toBeVisible({ timeout: 10_000 });
    await page.locator('#rg-route').click();
    await page.waitForSelector('#tournamentRegistrations', { state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(1200);

    // Rows must actually be on screen: an empty table would satisfy every
    // geometry assertion below for reasons that have nothing to do with the fix.
    const rowCount = await page.locator('#tournamentRegistrations .tabulator-row').count();
    expect(rowCount, 'no registration rows rendered — the geometry check would be vacuous').toBeGreaterThan(5);

    const shortfall = await shellShortfall(page);
    expect(shortfall, `registrations: #root stops ${shortfall}px above the viewport bottom`).toBeLessThanOrEqual(1);

    // And the table itself must reach the bottom of its panel rather than
    // stopping short of it — the shell can be flush while the table is not.
    // Measured at 168px short before the fix (280px of allowance for ~112px of
    // real chrome).
    const tableGap = await page.evaluate(() => {
      const el = document.getElementById('tournamentRegistrations');
      return globalThis.innerHeight - el!.getBoundingClientRect().bottom;
    });
    expect(tableGap, `registrations table floats ${tableGap}px above the fold`).toBeLessThanOrEqual(1);

    // 40 rows in a ~1050px panel must scroll INSIDE the table, not push the
    // document — the whole point of giving the host a bounded height.
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight <= globalThis.innerHeight + 1),
      'the registrations table grew the document instead of scrolling internally',
    ).toBe(true);
  });

  test('a report longer than the panel caps and scrolls inside itself', async ({ page }) => {
    // `maxHeight: '100%'` is the riskier of the two table conversions: a
    // percentage max-height resolves to `none` against an auto-height parent, and
    // the failure is invisible on a short report — it only shows when there are
    // more rows than fit. 128 entries is comfortably more than a 1200px window.
    const tournamentId = await seedTournament(page, {
      tournamentName: 'Long Report Probe',
      drawProfiles: [{ eventName: 'Main Singles', drawSize: 128 }],
      participantsProfile: { scaledParticipantsCount: 128 },
    });

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await page.locator('#r-route').click();
    await page.waitForSelector('#tournamentReports', { state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(1500);

    const rowCount = await page.locator('#tournamentReports .tabulator-row').count();
    expect(rowCount, 'no report rows rendered — the cap check would be vacuous').toBeGreaterThan(5);

    const tableBottomGap = await page.evaluate(() => {
      const el = document.getElementById('tournamentReports');
      return globalThis.innerHeight - el!.getBoundingClientRect().bottom;
    });
    expect(tableBottomGap, `report table overruns the fold by ${-tableBottomGap}px`).toBeGreaterThanOrEqual(-1);

    expect(
      await page.evaluate(() => document.documentElement.scrollHeight <= globalThis.innerHeight + 1),
      'the report grew the document instead of capping at the panel',
    ).toBe(true);
  });

  test('a tab taller than the window still scrolls the document', async ({ page }) => {
    // The other half of the fill chain, and the half a stray `min-height: 0`
    // silently breaks: growth must not become containment. Proven by shrinking
    // the window rather than by growing the data — most tables scroll inside
    // themselves (`height: innerHeight * 0.85`), so a row count is not a
    // reliable way to outgrow the viewport, while a 500px window always is.
    const tournamentId = await seedTournament(page, {
      tournamentName: 'Tall Tab Probe',
      participantsProfile: { scaledParticipantsCount: 32 },
      drawProfiles: [{ eventName: 'Main Singles', drawSize: 32 }],
    });

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await page.locator('#o-route').click();
    await page.waitForSelector('#overview', { state: 'visible', timeout: 15_000 });
    await page.setViewportSize({ width: 1620, height: 500 });
    await page.waitForTimeout(1000);

    const { scrollHeight, innerHeight } = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: globalThis.innerHeight,
    }));
    expect(scrollHeight, 'the overview should outgrow a 500px window').toBeGreaterThan(innerHeight);

    // And the overflow must be reachable — a clipped tab scrolls to nothing.
    await page.evaluate(() => globalThis.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(300);
    const scrolled = await page.evaluate(() => globalThis.scrollY);
    expect(scrolled, 'the document did not scroll — content is contained, not overflowed').toBeGreaterThan(0);
  });

  test('the scheduling action bar sits on the bottom of the workspace', async ({ page }) => {
    const tournamentId = await seedTournament(page, {
      tournamentName: 'Schedule Footer Probe',
      drawProfiles: [{ eventName: 'Main Singles', drawSize: 16 }],
      venueProfiles: [{ courtsCount: 6, venueName: 'Center Courts' }],
    });

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToScheduling();
    await page.waitForSelector('.spl-publish-pill', { timeout: 15_000 });
    await page.waitForTimeout(1000);

    // The publish pill lives in the grid's action bar, which is the last row of
    // a height:100% flex column inside `#schedulingContainer` — so its bottom
    // edge IS the container's bottom edge. Measuring the pill rather than the
    // bar keeps this probe off gridView's internal markup, which PR #1326 owns.
    const gap = await page.evaluate(() => {
      const pill = document.querySelector('.spl-publish-pill');
      if (!pill) throw new Error('publish pill missing');
      return globalThis.innerHeight - pill.getBoundingClientRect().bottom;
    });

    // The bar owns 8px of bottom padding; beyond ~24px is dead space. Measured
    // at 52px before the fix (8px padding + the 44px the calc() overshot by).
    expect(gap, `action bar floats ${gap}px above the viewport bottom`).toBeLessThanOrEqual(24);
  });
});
