import { test, expect } from '@playwright/test';
import { initDevBridge, loginAsSuperAdmin, resetState, waitForAppReady } from '../helpers/dev-bridge';

/**
 * Journey 112 — the Linked Tournaments beta toggle must actually do something.
 *
 * Regression (#1370): the toggle appeared to do nothing anywhere. Everything around it
 * worked — the change event fired, the flag persisted to `tmx_settings`, `syncLinkedPanel`
 * ran, and forcing the gate true rendered the panel correctly. The single cause was the
 * eligibility gate:
 *
 *   const linkedEligible = !options?.excludeTournament && !!getUserContext();
 *
 * `getUserContext()` is a SYNCHRONOUS read of a cache that only `/auth/me` populates, and
 * `fetchUserContext()` is called fire-and-forget at login/boot. So the gate reads undefined
 * whenever the grid renders before that request resolves — and because the value is captured
 * by the `syncLinkedPanel` closure, a context arriving later never un-sticks it. The panel
 * was unavailable for the life of the render.
 *
 * It is now `getLoginState()`: the same question (is there an authenticated user), answered
 * by validating the JWT locally. No network, no race. Deliberately NOT `ensureUserContext()`,
 * which would fire `/auth/me` for logged-out users — baseApi turns a 401 into a full logout,
 * the cascade #1218 and #1370 were fixing.
 *
 * The second case below is the other half: the Beta Features panel renders on the global
 * /settings page too, but the panel it controls is tournament-scoped, so the checkbox could
 * never work there. An inert control is the same defect with a different cause.
 */

const PANEL = '#linkedTournamentsPanel';
const CHECKBOX = '#linkedTournaments';
const LABEL = 'label[for="linkedTournaments"]';

async function seedTournament(page: any): Promise<string> {
  return page.evaluate(async () => {
    await dev.tmx2db.initDB();
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      nonRandom: 1,
      setState: true,
      tournamentName: 'E2E Linked Tournaments Toggle',
      drawProfiles: [{ eventName: 'Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
    });
    await dev.tmx2db.addTournament(tournamentRecord);
    return tournamentRecord.tournamentId as string;
  });
}

test('logged in, the toggle shows and hides the Linked Tournaments panel', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);
  await loginAsSuperAdmin(page);
  const tournamentId = await seedTournament(page);

  await page.goto(`/#/tournament/${tournamentId}/settings`);
  await page.locator('#tournamentSettings .settings-panel').first().waitFor({ timeout: 15_000 });

  // Off by default.
  await expect(page.locator(PANEL)).toHaveCount(0);

  // `.is-checkradio` hides the real input and styles the label, so click the LABEL —
  // that is the actual user gesture. Clicking the input would fail as "not visible".
  await page.locator(LABEL).click();
  await expect(page.locator(PANEL)).toHaveCount(1);
  await expect(page.locator(CHECKBOX)).toBeChecked();

  // …and back off again, in place, without a tab re-render.
  await page.locator(LABEL).click();
  await expect(page.locator(PANEL)).toHaveCount(0);
});

test('the toggle is not offered on the global settings page, where it could do nothing', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);
  await loginAsSuperAdmin(page);

  await page.goto('/#/settings');
  await page.locator('.settings-panel').first().waitFor({ timeout: 15_000 });

  // The Beta Features panel IS here — the control, so "checkbox absent" cannot pass
  // by the panel simply having failed to render.
  await expect(page.locator('#assistant')).toHaveCount(1);
  await expect(page.locator(CHECKBOX)).toHaveCount(0);
});

test('logged out, the toggle does not expose the provider-authenticated panel', async ({ page }) => {
  const calendarReqs: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/provider/my-calendars')) calendarReqs.push(r.url());
  });

  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page); // logged out
  await page.evaluate(() => localStorage.clear());
  const tournamentId = await seedTournament(page);

  await page.goto(`/#/tournament/${tournamentId}/settings`);
  await page.locator('#tournamentSettings .settings-panel').first().waitFor({ timeout: 15_000 });

  await page.locator(LABEL).click();
  await page.waitForTimeout(600);

  // The panel 401s and baseApi turns that into a full logout, so it must stay hidden.
  await expect(page.locator(PANEL)).toHaveCount(0);
  expect(calendarReqs, `my-calendars was called while logged out: ${calendarReqs.join(', ')}`).toEqual([]);
});
