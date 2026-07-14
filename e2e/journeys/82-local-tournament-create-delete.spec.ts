import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';

/**
 * Journey 82 — local (logged-out) tournament create + delete.
 *
 * A logged-out user works entirely against IndexedDB. Creating and deleting a local
 * tournament must persist/remove it locally and MUST NOT touch the CFS server
 * (`/factory` create/remove, `/provider/*` calendars). This guards the class of bug
 * where the settings tab hit an authenticated provider endpoint while logged out, 401'd,
 * and baseApi's interceptor logged the user out. Authenticated create is covered by
 * Journey 28; this covers the local path.
 */

// Requests to the server-only surfaces. /auth/me may fire on boot (harmless), so we
// scope to the create/delete/provider endpoints that a local flow must never call.
const SERVER_RE = /\/(factory|provider)\b/;

test.describe('Journey 82 — local tournament create + delete (logged out)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page); // logged-out state
    await page.evaluate(() => localStorage.clear());
  });

  test('create a local tournament — saved to IndexedDB, no server call', async ({ page }) => {
    const serverReqs: string[] = [];
    page.on('request', (r) => {
      if (SERVER_RE.test(r.url())) serverReqs.push(r.url());
    });

    const name = `E2E Local Create ${Date.now()}`;
    await page.goto('/#/tournaments');
    await page.waitForTimeout(300);
    serverReqs.length = 0; // ignore any boot-time calls; isolate the create action

    await page.getByRole('button', { name: /new tournament/i }).first().click();
    await page.waitForTimeout(400);

    await page.locator('.drawer input[type="text"]').first().fill(name);
    // vanillajs-datepicker opens on fill — type then Escape to dismiss.
    const start = page.locator('.drawer input[placeholder*="YYYY"]').nth(0);
    await start.click();
    await start.fill('2026-08-01');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    const end = page.locator('.drawer input[placeholder*="YYYY"]').nth(1);
    await end.click();
    await end.fill('2026-08-03');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);

    await page.locator('.drawer').getByRole('button', { name: /^add$/i }).click();
    await page.waitForTimeout(1200);

    const persisted = await page.evaluate(async (n) => {
      const all = await dev.tmx2db.findAllTournaments();
      return all.some((t: any) => t.tournamentName === n);
    }, name);
    expect(persisted, 'created tournament should be in IndexedDB').toBe(true);
    expect(serverReqs, `local create hit the server: ${serverReqs.join(', ')}`).toEqual([]);
  });

  test('delete a local tournament — removed from IndexedDB AND the calendar, no server call', async ({ page }) => {
    const serverReqs: string[] = [];
    page.on('request', (r) => {
      if (SERVER_RE.test(r.url())) serverReqs.push(r.url());
    });

    const tournamentId = await page.evaluate(async () => {
      await dev.tmx2db.initDB();
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        tournamentName: 'E2E Local Delete',
        drawProfiles: [{ eventName: 'Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
      });
      await dev.tmx2db.addTournament(tournamentRecord);
      // Seed the lightweight calendar entry too — the tournaments LIST renders from these,
      // not from the full records, so this mirrors a real saved tournament that appears in
      // the list. Deleting must remove BOTH; otherwise the tournament lingers in the list and
      // reopening it loads a now-missing record (broken navigation, no delete option).
      const entry = dev.factory.tournamentEngine.getTournamentCalendarEntry({ tournamentRecord });
      if (entry?.tournamentId) await dev.tmx2db.upsertCalendarEntry('__local__', entry);
      return tournamentRecord.tournamentId as string;
    });

    await page.goto(`/#/tournament/${tournamentId}/settings`);
    await page.locator('#tournamentSettings .panel-red').first().waitFor({ timeout: 15_000 });
    serverReqs.length = 0; // isolate the delete action

    await page.locator('#tournamentSettings .panel-red button').first().click(); // Danger-Zone delete
    await page.getByRole('button', { name: /confirm/i }).first().click(); // tmxToast confirm action
    await page.waitForTimeout(1200);

    const state = await page.evaluate(async (id) => {
      const records = await dev.tmx2db.findAllTournaments();
      const provider = await dev.tmx2db.findProvider('__local__');
      const calendar = Array.isArray(provider?.calendar) ? provider.calendar : [];
      return {
        recordGone: !records.some((t: any) => t.tournamentId === id),
        calendarEntryGone: !calendar.some((e: any) => e?.tournamentId === id),
      };
    }, tournamentId);

    expect(state.recordGone, 'record should be gone from IndexedDB').toBe(true);
    expect(state.calendarEntryGone, 'calendar entry must be gone — else it lingers in the list').toBe(true);
    expect(serverReqs, `local delete hit the server: ${serverReqs.join(', ')}`).toEqual([]);
  });
});
