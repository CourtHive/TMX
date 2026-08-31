import { routeApiToCfs } from '../helpers/cfsProxy';
import { test, expect } from '@playwright/test';
import { waitForAppReady } from '../helpers/dev-bridge';

const E2E_EMAIL = 'e2e-client@courthive.com';
const E2E_PASSWORD = 'e2e-test-pass';
const SERVER = 'http://localhost:8383';

// The provider this journey creates its tournament under, and whose calendar it then searches.
// Resolved by ABBREVIATION at runtime — never a hardcoded id. A literal providerId here silently
// bound the suite to one machine's database: on the box where it was written the id belonged to
// "TMX Sandbox", accumulated dev history that nothing seeded. Anywhere else the invite named a
// provider that did not exist, the tournament was never associated with TMX, and the calendar
// lookup returned nothing — surfacing as `expect(serverEntry).toBeTruthy()` receiving `undefined`,
// which says nothing about the cause. `Mentat/scripts/local/seed-local.mjs` now seeds this provider.
const PROVIDER_ABBR = 'TMX';

/**
 * Journey 28 — Authenticated tournament creation via server.
 *
 * Logs in as a client-role user (equivalent to tmx@courthive.com),
 * creates a new tournament through the UI drawer, and verifies:
 *   1. The tournament is saved on the server
 *   2. The tournament can be opened in TMX after creation
 */
/**
 * Remove a tournament created against the real server, regardless of test
 * outcome. Two hazards this handles that the old inline cleanup did not:
 *   1. It runs from a guaranteed `afterEach`, so a mid-test failure can't skip it.
 *   2. `/factory/remove` refuses to delete a tournament before its endDate
 *      (ERR_TOURNAMENT_NOT_ENDED, returned with HTTP 200 + removed:0). The
 *      created tournament has a future endDate, so we first move its dates to the
 *      past via executionQueue, THEN remove — and warn if it still wasn't removed
 *      so the failure is visible instead of silently leaking orphans.
 */
/**
 * Fetch the provider calendar as an OPERATOR — including unpublished tournaments.
 *
 * CFS 2.29.0 (`f972cdcd`) deliberately split these surfaces: `POST /provider/calendar`
 * is now the PUBLIC, anonymous feed and returns **published tournaments only**, reduced
 * to public fields. A tournament this journey has just created through the UI is not
 * published, so the public feed correctly does not contain it.
 *
 * Both call sites below used the public route and broke silently in different ways: the
 * assertion failed 60 lines from the cause with `expect(serverEntry).toBeTruthy()`
 * receiving `undefined`, and — worse — the cleanup simply returned early, so every run
 * since that release has ORPHANED its tournament on the server.
 *
 * `calendar/provider` is the operator feed for exactly this case. It is role-gated to
 * ADMIN / SUPER_ADMIN; the seeded `e2e-client@courthive.com` carries `admin`.
 */
async function fetchOperatorCalendar(request: any, token: string): Promise<any[]> {
  const result = await request.post(`${SERVER}/provider/calendar/provider`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { providerAbbr: PROVIDER_ABBR },
  });
  if (!result.ok()) return [];
  const calendar = await result.json().catch(() => ({}));
  return calendar?.calendar?.tournaments ?? calendar?.calendar ?? [];
}

async function cleanupServerTournament(request: any, token: string, tournamentName: string): Promise<void> {
  try {
    const entries = await fetchOperatorCalendar(request, token);
    const entry = entries.find((e: any) => (e.tournament?.tournamentName ?? e.tournamentName) === tournamentName);
    const tournamentId = entry?.tournamentId;
    if (!tournamentId) return; // never created (failed before save) or already removed

    // Move dates to the past so the not-ended delete guard allows removal.
    await request.post(`${SERVER}/factory`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tournamentId,
        methods: [
          {
            method: 'setTournamentDates',
            params: { startDate: '2020-01-01', endDate: '2020-01-02', activeDates: ['2020-01-01', '2020-01-02'] },
          },
        ],
      },
    });

    const removeResult = await request.post(`${SERVER}/factory/remove`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { tournamentId },
    });
    const removeBody = await removeResult.json().catch(() => ({}));
    if (!removeBody?.removed) {
      console.warn(`Journey 28 cleanup: tournament ${tournamentId} was not removed:`, removeBody);
    }
  } catch (err) {
    // Cleanup must never fail the run; surface it for visibility.
    console.warn('Journey 28 cleanup failed:', err);
  }
}

test.describe('Journey 28 — Authenticated server tournament creation', () => {
  let authToken: string;
  let providerId: string | undefined;
  let cfsReachable = false;
  let createdTournamentName: string | undefined;

  test.beforeAll(async ({ request }) => {
    // Probe CFS first — this is the only e2e spec that needs the server up.
    // Local-only runs without CFS skip cleanly instead of timing out 6+ times.
    // Any HTTP response (including 301/404) counts as "reachable" — only an
    // ECONNREFUSED / timeout means the server is actually down.
    try {
      await request.get(`${SERVER}/`, {
        failOnStatusCode: false,
        maxRedirects: 0,
        timeout: 2000,
      });
      cfsReachable = true;
    } catch {
      cfsReachable = false;
    }
    if (!cfsReachable) return;

    // Admin session — needed to resolve the provider.
    const adminLogin = await request.post(`${SERVER}/auth/login`, {
      data: { email: 'axel@castle.com', password: 'castle' },
    });
    const adminToken = (await adminLogin.json()).token;

    // Resolve the provider by abbreviation, never by a literal id. A hardcoded providerId bound
    // this journey to one machine's database: the id belonged to "TMX Sandbox", accumulated dev
    // history that nothing seeded, so anywhere else the tournament was never associated with TMX
    // and the calendar lookup came back empty — surfacing 60 lines later as
    // `expect(serverEntry).toBeTruthy()` receiving `undefined`, which names nothing.
    const providerList = await request.post(`${SERVER}/provider/allproviders`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const providers = (await providerList.json().catch(() => ({})))?.providers ?? [];
    providerId = providers.find((p: any) => p?.value?.organisationAbbreviation === PROVIDER_ABBR)?.value
      ?.organisationId;
    expect(
      providerId,
      `No provider abbreviated "${PROVIDER_ABBR}" on ${SERVER}. Seed it: node Mentat/scripts/local/seed-local.mjs`,
    ).toBeTruthy();

    // Log in as the seeded e2e account. This journey deliberately does NOT provision the user
    // itself: it used to, via POST /auth/invite + /auth/register, and both routes have since been
    // removed from the ecosystem. Nobody noticed because the journey returns early when the login
    // succeeds, so the dead path only ran on hosts where the account did not already exist — where
    // it 404'd and the failure surfaced as an unrelated assertion much later. The account is now
    // seeded alongside every other test identity; require it and say so when it is absent.
    const login = await request.post(`${SERVER}/auth/login`, {
      data: { email: E2E_EMAIL, password: E2E_PASSWORD },
    });
    expect(
      login.ok(),
      `Cannot log in as ${E2E_EMAIL} on ${SERVER}. Seed it: node Mentat/scripts/local/seed-local.mjs`,
    ).toBeTruthy();
    authToken = (await login.json()).token;
  });

  // Guaranteed teardown — runs even if the test throws mid-way, so a created
  // tournament is never orphaned on the server (see cleanupServerTournament).
  test.afterEach(async ({ request }) => {
    if (!cfsReachable || !createdTournamentName) return;
    await cleanupServerTournament(request, authToken, createdTournamentName);
    createdTournamentName = undefined;
  });

  test('create tournament via UI, verify on server, open it', async ({ page, request }) => {
    test.skip(!cfsReachable, `CFS not reachable at ${SERVER}`);
    const tournamentName = `E2E Server ${Date.now()}`;
    // Record immediately so afterEach can clean up even if a later step fails.
    createdTournamentName = tournamentName;

    // Under TEST_PROD the built app calls its own origin and `vite preview` has no
    // API behind it, so the UI login below would 404 silently. See cfsProxy.
    await routeApiToCfs(page);

    await page.goto('/');
    await waitForAppReady(page);

    // ── Login ──
    await page.locator('#login').click();
    await page.getByText('Log in').click();

    // Fill email (placeholder: valid@email.com)
    await page.locator('input[placeholder*="email"]').fill(E2E_EMAIL);
    await page.locator('input[placeholder*="8 characters"]').fill(E2E_PASSWORD);
    // The login modal's submit button has id `loginButton` — use that
    // directly. The top-nav user widget also surfaces a "Login" affordance,
    // so a plain getByRole('button', { name: 'Login' }) is ambiguous.
    await page.locator('#loginButton').click();

    // Wait for login to complete
    await page.waitForTimeout(1500);

    // Verify logged in — login icon should change color
    const loginIcon = page.locator('#login');
    await expect(loginIcon).toBeVisible();

    // ── Create tournament ──
    await page.getByRole('button', { name: /new tournament/i }).click();
    await page.waitForTimeout(500);

    // The edit tournament drawer opens — fill the name (first text input)
    const nameField = page.locator('.drawer input[type="text"]').first();
    await nameField.fill(tournamentName);

    // Fill start and end dates — vanillajs-datepicker opens a calendar on fill.
    // Type the date then press Escape to dismiss the picker.
    const startDate = page.locator('.drawer input[placeholder*="YYYY"]').nth(0);
    await startDate.click();
    await startDate.fill('2026-07-01');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    const endDate = page.locator('.drawer input[placeholder*="YYYY"]').nth(1);
    await endDate.click();
    await endDate.fill('2026-07-07');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Click Add button in the drawer
    await page.locator('.drawer').getByRole('button', { name: /^add$/i }).click();

    // Wait for server save to complete
    await page.waitForTimeout(3000);

    // ── Verify tournament exists on server ──
    // Check calendar for the tournament
    const entries = await fetchOperatorCalendar(request, authToken);
    const serverEntry = entries.find((e: any) => {
      const name = e.tournament?.tournamentName ?? e.tournamentName;
      return name === tournamentName;
    });

    expect(
      serverEntry,
      `"${tournamentName}" is not on ${PROVIDER_ABBR}'s operator calendar — the UI create did not reach the server`,
    ).toBeTruthy();
    const tournamentId = serverEntry.tournamentId;
    expect(tournamentId).toBeTruthy();

    // Verify full record exists
    const fetchResult = await request.post(`${SERVER}/factory/fetch`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { tournamentId },
    });
    const fetchData = await fetchResult.json();
    expect(fetchData.success).toBe(true);
    expect(fetchData.tournamentRecords?.[tournamentId]).toBeTruthy();

    // ── Open the tournament ──
    // Navigate to tournaments list — this fetches the calendar from the server
    await page.goto('/#/tournaments');
    await page.waitForTimeout(2000);

    // The tournaments listing defaults to table view, but a prior spec in
    // this browser context may have persisted cards mode. Re-clicking
    // Table view is idempotent (onChange early-returns when already in
    // table mode) so this is safe either way.
    const tableToggle = page.getByRole('button', { name: 'Table view' });
    await tableToggle.waitFor({ state: 'visible', timeout: 5_000 });
    if ((await tableToggle.getAttribute('aria-pressed')) !== 'true') {
      await tableToggle.click();
    }

    // The tournament should appear in the server-fetched calendar list.
    // Click the cell containing the tournament name — the row-level click
    // doesn't navigate because Tabulator wires `cellClick: openTournament`
    // on specific columns (name, etc.) rather than the whole row.
    const row = page.locator('.tabulator-row').filter({ hasText: tournamentName });
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.getByText(tournamentName).first().click();

    // Should navigate into the tournament
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('tournament');

    // Verify the tournament overview loaded — the tournament name appears in the navbar
    await expect(page.locator('#dnav')).toContainText(tournamentName, { timeout: 10000 });

    // Cleanup runs in afterEach (guaranteed even on failure) — see cleanupServerTournament.
  });
});
