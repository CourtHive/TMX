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

  test('the SAME fixture appears in the other programme season — which no calendar could express', async ({
    page,
  }) => {
    test.skip(!fixture, `seed unavailable — CFS at ${SERVER}: ${skipReason}`);
    const f = fixture as ParticipationFixture;

    await loginViaModal(page);

    // Reached by URL rather than by impersonating again: the point of putting the subject in the
    // path is that an operator can read a season without becoming that provider.
    await page.goto(`/#/provider/${f.programmeB.providerId}/schedule`);
    const row = page.locator(`${S.PARTICIPATION_LIST} [data-tournament-id="${f.tournamentId}"]`);
    await expect(row).toBeVisible({ timeout: 15_000 });

    // And the fixture reached both seasons WITHOUT being in anybody's calendar. Read the calendar of
    // the provider that actually OWNS it — the only one it could possibly be listed in.
    const calendar = await page.request.post(`${SERVER}/provider/calendar/provider`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { providerAbbr: f.governingAbbr },
    });
    const body = await calendar.json().catch(() => ({}));
    const tournamentIds = (body?.calendar?.tournaments ?? []).map((t: any) => t.tournamentId);

    // CONTROL first. An empty or unreachable calendar would satisfy the exclusion below no matter
    // what the `calendarListed` seam did — so prove the read works by finding the ordinary,
    // deliberately-listed tournament seeded under the same owner.
    expect(tournamentIds).toContain(f.listedTournamentId);
    // Only now does this mean anything: the fixture is owned by this provider and still absent from
    // its calendar, which is what lets it belong to two programmes' seasons at once.
    expect(tournamentIds).not.toContain(f.tournamentId);
  });

  test('a programme with no fixtures reads as an empty season, never as a failure', async ({ page }) => {
    test.skip(!fixture, `seed unavailable — CFS at ${SERVER}: ${skipReason}`);
    const f = fixture as ParticipationFixture;

    await loginViaModal(page);
    await page.goto(`/#/provider/${f.emptyProgramme.providerId}/schedule`);

    const notice = page.locator(`${S.PARTICIPATION_LIST} [data-notice-variant]`);
    await expect(notice).toBeVisible({ timeout: 15_000 });
    // The whole point: `empty`, not `error`. Asserting the variant attribute rather than the copy
    // means a reworded message cannot quietly turn this into a test of nothing.
    await expect(notice).toHaveAttribute('data-notice-variant', 'empty');
    await expect(page.locator(`${S.PARTICIPATION_CONTROL} [data-fixture-count="0"]`)).toBeVisible();
  });

  // The other half of the pair above, and the one that gives it meaning. An empty season and a
  // failed load are the two answers a user is most likely to confuse, and a page that rendered
  // BOTH as "no fixtures recorded" would pass the previous test perfectly while telling an operator
  // that a programme has no season during an outage. Asserted here against a refused request.
  test('a refused request reads as a failure, never as an empty season', async ({ page }) => {
    test.skip(!fixture, `seed unavailable — CFS at ${SERVER}: ${skipReason}`);
    const f = fixture as ParticipationFixture;

    await loginViaModal(page);
    // Registered AFTER routeApiToCfs so it wins — Playwright tries handlers in reverse order.
    await page.route('**/participation/**', (route) =>
      route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Forbidden' }) }),
    );

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
