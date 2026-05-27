import { test, expect } from '@playwright/test';
import { waitForAppReady } from '../helpers/dev-bridge';

const E2E_EMAIL = 'e2e-client@courthive.com';
const E2E_PASSWORD = 'e2e-test-pass';
const SERVER = 'http://localhost:8383';

/**
 * Journey 28 — Authenticated tournament creation via server.
 *
 * Logs in as a client-role user (equivalent to tmx@courthive.com),
 * creates a new tournament through the UI drawer, and verifies:
 *   1. The tournament is saved on the server
 *   2. The tournament can be opened in TMX after creation
 */
test.describe('Journey 28 — Authenticated server tournament creation', () => {
  let authToken: string;
  let cfsReachable = false;

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

    // Ensure the e2e test user exists
    const loginAttempt = await request.post(`${SERVER}/auth/login`, {
      data: { email: E2E_EMAIL, password: E2E_PASSWORD },
    });

    if (loginAttempt.ok()) {
      authToken = (await loginAttempt.json()).token;
      return;
    }

    // Create via admin invite flow
    const adminLogin = await request.post(`${SERVER}/auth/login`, {
      data: { email: 'axel@castle.com', password: 'castle' },
    });
    const adminToken = (await adminLogin.json()).token;

    const invite = await request.post(`${SERVER}/auth/invite`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        email: E2E_EMAIL,
        providerId: 'fce22f65-08d5-4df5-998f-cbead6e823a4',
        roles: ['client', 'admin', 'score'],
      },
    });
    const inviteCode = (await invite.json()).inviteCode;

    await request.post(`${SERVER}/auth/register`, {
      data: { email: E2E_EMAIL, password: E2E_PASSWORD, firstName: 'E2E', lastName: 'Client', code: inviteCode },
    });

    const login = await request.post(`${SERVER}/auth/login`, {
      data: { email: E2E_EMAIL, password: E2E_PASSWORD },
    });
    authToken = (await login.json()).token;
  });

  test('create tournament via UI, verify on server, open it', async ({ page, request }) => {
    test.skip(!cfsReachable, `CFS not reachable at ${SERVER}`);
    const tournamentName = `E2E Server ${Date.now()}`;

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
    const calendarResult = await request.post(`${SERVER}/provider/calendar`, {
      data: { providerAbbr: 'TMX' },
    });
    const calendar = await calendarResult.json();
    const entries = calendar?.calendar?.tournaments ?? calendar?.calendar ?? [];
    const serverEntry = entries.find((e: any) => {
      const name = e.tournament?.tournamentName ?? e.tournamentName;
      return name === tournamentName;
    });

    expect(serverEntry).toBeTruthy();
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

    // ── Cleanup ──
    await request.post(`${SERVER}/factory/remove`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { tournamentId },
    });
  });
});
