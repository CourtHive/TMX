import { test, expect, type Page } from '@playwright/test';
import { routeApiToCfs } from '../helpers/cfsProxy';
import { waitForAppReady } from '../helpers/dev-bridge';
import { S } from '../helpers/selectors';
import {
  cleanupParticipationFixture,
  seedParticipationFixture,
  type ParticipationFixture,
} from '../helpers/participationFixtures';
import { SERVER, signInSuperAdmin, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD } from '../helpers/role-fixtures';

/**
 * Journey 119 — a programme's SCHEDULE, and why it cannot be its calendar.
 *
 * ## Why the read is STUBBED here, and what still proves the rest
 *
 * The season is served by **courthive-query**, a different service from CFS. Reaching it for real
 * from a journey would need CFS's projection outbox enabled locally, its consumer running, and the
 * factory release that puts a durable team id on entries — three moving parts outside TMX, none of
 * which this spec is about. So the transport is stubbed, and this journey asserts what is genuinely
 * TMX's: the nav gate, the route, the rendering, and the four states.
 *
 * The layers it does not cover are covered where they belong, not nowhere:
 *   - the read model's semantics (an entered-but-unpublished fixture is visible to an operator and
 *     NOT to the public) — courthive-query's own DB-backed `query-verify.e2e.spec.ts`;
 *   - the whole chain against real data — the acceptance run against Button, recorded in
 *     `Mentat/statuses/2026-08-31-tmx-provider-schedule-participation.md`.
 *
 * The tournament IS seeded for real, because "drill through to its results" must open a record CFS
 * actually holds.
 *
 * The mandate journey, end to end: sign in as a super-admin, impersonate a programme, reach that
 * programme's fixtures, and drill from one into its results.
 *
 * The distinction being protected is not cosmetic. A tournament lives in exactly ONE provider's
 * calendar — `detachFromOtherCalendars` enforces it — while a college dual belongs to the seasons
 * of TWO programmes. So the fixture seeded here is owned by a governing body, carries
 * `calendarListed: false`, and appears in NO calendar; both programmes reach it only through the
 * participation read model. The second test asserts exactly that: the SAME fixture in BOTH
 * seasons. Ownership can only ever name one side, which is why a calendar could not pass it.
 *
 * The third and fourth tests are a PAIR, and neither means much alone. A subject that took part in
 * nothing is an ordinary correct answer — dozens of seeded team providers are in it — while a
 * refused request is a fault. A page that rendered both as "no fixtures recorded" would pass the
 * third test perfectly and tell an operator a programme has no season during an outage.
 *
 * Real login and a real CFS, not token injection: the participation route is role-gated
 * `@Roles([ADMIN, SUPER_ADMIN])`, so the JWT has to be genuine. If the bootstrap super-admin is
 * unavailable the whole journey skips rather than red-failing CI on a missing seed (journeys 28,
 * 36 and 58 do the same).
 */

let token: string | null = null;
let fixture: ParticipationFixture | null = null;
/**
 * EVERY fixture this file has seeded, not just the current one. Playwright re-runs `beforeAll` on a
 * retry, so a single `fixture` variable is overwritten by the reseed; if the paired `afterAll` did
 * not also run per cycle, every retry would orphan a tournament on a shared dev server.
 *
 * Measured, because the first version of this comment claimed the leak was real and it is not:
 * after a deliberately-failed run, all six seeded ids read back absent — Playwright does run
 * `afterAll` for each cycle. (The check that first said otherwise had no control and was reading
 * `401 Unauthorized` bodies as "present"; a checker with a known-absent control settled it.)
 * Accumulating is kept anyway: it removes the failure mode rather than depending on hook ordering,
 * and it costs one array.
 */
const seeded: ParticipationFixture[] = [];
/** Why the seed was unavailable, so a skip is never just "unavailable" — see `beforeAll`. */
let skipReason = '';

async function loginViaModal(page: Page): Promise<void> {
  await routeApiToCfs(page);
  await page.goto('/');
  await waitForAppReady(page);
  await page.locator('#login').click();
  await page.getByText('Log in').click();
  await page.locator('input[placeholder*="email"]').fill(SUPERADMIN_EMAIL);
  await page.locator('input[placeholder*="8 characters"]').fill(SUPERADMIN_PASSWORD);
  await page.locator('#loginButton').click();
  // Sign-in + provider resolution are async; subsequent assertions poll, so this is a floor.
  await page.waitForTimeout(1500);
}

/** The read TMX now performs — courthive-query's operator route, same-origin `/query/...` under
 *  TEST_PROD. Stubbed per test so each state is exact and no second service has to be standing. */
async function stubSeason(page: Page, body: unknown, status = 200): Promise<void> {
  await page.route('**/programs/**/participations', (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

/** Impersonate a provider through the super-admin switcher — the mandate's own entry point. */
async function impersonate(page: Page, providerName: string): Promise<void> {
  await page.locator('#provider').click();
  await page.getByText(/(Select|Switch) provider/).click();
  const input = page.locator('input[placeholder="Type provider name"]');
  await input.click();
  await input.fill(providerName);
  await page.locator('ul[role="listbox"] li', { hasText: providerName }).first().click();
  await page.locator('#selectButton').click();
  await page.waitForTimeout(1000);
}

test.describe('Journey 119 — provider schedule from the participation index', () => {
  test.beforeAll(async ({ request }) => {
    token = await signInSuperAdmin(request);
    if (!token) {
      // `signInSuperAdmin` swallows the reason, so a skipped journey otherwise reads as "the
      // bootstrap account is missing" for every cause. It is usually not: this journey performs
      // five logins per run (one API, one UI per test), so repeated local runs reliably trip CFS's
      // login throttler and a 429 skips the whole file. Naming the status makes a rate-limited run
      // distinguishable from an unseeded machine, which is the difference between "wait a minute"
      // and "your CFS is not set up".
      const probe = await request
        .post(`${SERVER}/auth/login`, {
          data: { email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD },
          timeout: 5000,
        })
        .catch(() => null);
      skipReason = probe ? `POST /auth/login → ${probe.status()}` : 'CFS unreachable';
      return;
    }
    fixture = await seedParticipationFixture(request, token);
    seeded.push(fixture);
  });

  test.afterAll(async ({ request }) => {
    if (!token) return;
    for (const each of seeded.splice(0)) await cleanupParticipationFixture(request, token, each);
  });

  test('impersonating a programme reaches its fixtures, and one drills through to results', async ({ page }) => {
    test.skip(!fixture, `seed unavailable — CFS at ${SERVER}: ${skipReason}`);
    const f = fixture as ParticipationFixture;

    await loginViaModal(page);
    // The season is stubbed; the TOURNAMENT it names is real and seeded on CFS, so clicking the row
    // opens a record the server actually holds and the results assertion below means something.
    await stubSeason(page, {
      teamId: f.programmeA.providerId,
      participations: [
        {
          tournamentId: f.tournamentId,
          tournamentName: f.tournamentName,
          startDate: f.startDate,
          endDate: f.startDate,
          providerId: f.governingProviderId,
          teamName: f.programmeA.name,
        },
      ],
    });
    await impersonate(page, f.programmeA.name);

    // The nav entry is the discoverable path from where the journey previously dead-ended.
    const scheduleIcon = page.locator(S.NAV_HOME_SCHEDULE);
    await expect(scheduleIcon).toBeVisible({ timeout: 10_000 });
    await scheduleIcon.click();

    // The subject is in the URL, not merely in the impersonation context — that is what makes a
    // season addressable for a subject other than the active provider.
    await expect(page).toHaveURL(new RegExp(`#/provider/${f.programmeA.providerId}/schedule$`));

    const row = page.locator(`${S.PARTICIPATION_LIST} [data-tournament-id="${f.tournamentId}"]`);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row).toContainText(f.tournamentName);
    // The raw ISO day, not the localized rendering — the assertion must not depend on the locale
    // the runtime happens to pick.
    await expect(row).toHaveAttribute('data-start-date', f.startDate);
    await expect(page.locator(`${S.PARTICIPATION_CONTROL} [data-fixture-count="1"]`)).toBeVisible();

    // And the fixture is real competition, not a shell: drill through to its matchUps.
    await row.click();
    await expect(page).toHaveURL(new RegExp(`#/tournament/${f.tournamentId}`));
    // Wait for the tournament to finish loading BEFORE changing tab. The record is fetched from the
    // server, and that render lands on the default tab — a tab switch issued while it is in flight
    // is overwritten by it, which reads as "the matchUps tab is broken" rather than as a race.
    await expect(page.locator(S.TOURNAMENT_OVERVIEW)).toBeVisible({ timeout: 20_000 });

    await page.locator(S.NAV_MATCHUPS).click();
    await expect(page.locator(S.TOURNAMENT_MATCHUPS)).toBeVisible({ timeout: 20_000 });
    // Seeded with `completeAllMatchUps`, so every matchUp carries a result. A visible container
    // with no rows would satisfy the line above and prove nothing.
    await expect(page.locator(`${S.TOURNAMENT_MATCHUPS} .tabulator-row`).first()).toBeVisible({ timeout: 20_000 });
  });

  // REMOVED — "the SAME fixture appears in BOTH programmes' seasons, and in neither calendar".
  //
  // It was the sharpest test here, and it cannot live at this layer any more. With the season
  // stubbed it would assert the stub — my own fixture data — rather than anything the system
  // decided. A test that can only confirm what the test itself supplied is worse than no test,
  // because it reads like coverage.
  //
  // The property is real and still tested, one layer down and against real Postgres:
  // `courthive-query/src/modules/query/query-verify.e2e.spec.ts` asserts that a team which merely
  // ENTERED an unpublished tournament is found by the operator read and NOT by the public one,
  // with a deliberately-listed control tournament proving the calendar read works at all.

  test('a programme with no fixtures reads as an empty season, never as a failure', async ({ page }) => {
    test.skip(!fixture, `seed unavailable — CFS at ${SERVER}: ${skipReason}`);
    const f = fixture as ParticipationFixture;

    await loginViaModal(page);
    await stubSeason(page, { teamId: f.emptyProgramme.providerId, participations: [] });
    await page.goto(`/#/provider/${f.emptyProgramme.providerId}/schedule`);

    const notice = page.locator(`${S.PARTICIPATION_LIST} [data-notice-variant]`);
    await expect(notice).toBeVisible({ timeout: 15_000 });
    // The whole point: `empty`, not `error`. Asserting the variant attribute rather than the copy
    // means a reworded message cannot quietly turn this into a test of nothing.
    await expect(notice).toHaveAttribute('data-notice-variant', 'empty');
    await expect(page.locator(`${S.PARTICIPATION_CONTROL} [data-fixture-count="0"]`)).toBeVisible();
  });

  // The other half of the pair above. An empty season and a failed load are the two answers a user
  // is most likely to confuse, and a page rendering BOTH as "no fixtures recorded" would pass the
  // previous test perfectly while telling an operator a programme has no season during an outage.
  //
  // ⚠️ WHAT THIS DOES NOT GUARD, measured rather than assumed. A refused request makes axios reject,
  // so `baseApi` returns `undefined` and the reader's FIRST guard (`!response`) produces the error
  // state — the response BODY is never parsed. Injecting the lenient-reader defect
  // (`participations ?? []`, which turns a refusal into "0 fixtures") and building it into the
  // bundle leaves all three tests here GREEN. The unit suite is what catches it: the same defect
  // fails three cases in `participationEntries.test.ts`, including a 401 body with no
  // `participations` key at all.
  //
  // So this test guards the UI rendering a failure on a refused transport. It is not, and cannot
  // be, the guard on how a refusal BODY is read.
  test('a refused request reads as a failure, never as an empty season', async ({ page }) => {
    test.skip(!fixture, `seed unavailable — CFS at ${SERVER}: ${skipReason}`);
    const f = fixture as ParticipationFixture;

    await loginViaModal(page);
    // Registered AFTER routeApiToCfs so it wins — Playwright tries handlers in reverse order.
    // A 403 body with no `participations` key at all: exactly what the query service returns behind
    // its guard, and exactly the shape a lenient reader turns into "0 fixtures".
    await stubSeason(page, { message: 'Forbidden', error: 'Forbidden', statusCode: 403 }, 403);

    // The SAME subject the first test read a fixture for, so the difference between the two
    // outcomes can only be the refusal — not a different, emptier subject.
    await page.goto(`/#/provider/${f.programmeA.providerId}/schedule`);

    const notice = page.locator(`${S.PARTICIPATION_LIST} [data-notice-variant]`);
    await expect(notice).toBeVisible({ timeout: 15_000 });
    await expect(notice).toHaveAttribute('data-notice-variant', 'error');
    // And no count is claimed, because there is no data to make a claim about. Asserted by COUNT,
    // not visibility: the span is deliberately empty, and an empty span has no box to be visible.
    await expect(page.locator(`${S.PARTICIPATION_CONTROL} [data-fixture-count=""]`)).toHaveCount(1);
  });
});
