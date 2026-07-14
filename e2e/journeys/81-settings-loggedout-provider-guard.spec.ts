import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';

/**
 * Journey 81 — logged-out settings tab must not hit provider-authenticated endpoints.
 *
 * Regression (#1218 linked-tournaments): renderSettingsTab unconditionally rendered the
 * provider linked-tournaments panel, whose fetchSiblings called `/provider/my-calendars`.
 * Logged out that 401s, and baseApi's response interceptor treats a 401 as a FULL LOGOUT —
 * which broke the whole settings tab (and blocked deleting a local tournament). The panel
 * and its fetch are now gated on getUserContext(), so a logged-out user gets a clean tab.
 */
test('logged-out settings tab renders and never calls /provider/my-calendars', async ({ page }) => {
  const calendarReqs: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/provider/my-calendars')) calendarReqs.push(r.url());
  });

  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page); // logged-out state
  await page.evaluate(() => localStorage.clear());

  // Seed via a direct IDB write (no dev.load navigation) so the /settings goto isn't overridden.
  const tournamentId = await page.evaluate(async () => {
    await dev.tmx2db.initDB();
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      nonRandom: 1,
      setState: true,
      tournamentName: 'E2E Settings LoggedOut',
      participantsProfile: { scaledParticipantsCount: 8 },
      drawProfiles: [{ eventName: 'Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
    });
    await dev.tmx2db.addTournament(tournamentRecord);
    return tournamentRecord.tournamentId as string;
  });

  await page.goto(`/#/tournament/${tournamentId}/settings`);
  // A rendered settings panel proves the tab loaded (not broken by a 401→logout). Class-based
  // so it doesn't race i18n label loading.
  await page.locator('#tournamentSettings .settings-panel').first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(600); // let any deferred provider fetch fire (it must not)

  expect(calendarReqs, `my-calendars was called while logged out: ${calendarReqs.join(', ')}`).toEqual([]);
});
