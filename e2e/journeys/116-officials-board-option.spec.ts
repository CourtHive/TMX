import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { S } from '../helpers/selectors';

/**
 * Journey 116 — the Officials board is opt-in, from Options rather than Beta features.
 *
 * The board itself (journey 106) is finished and in production. What is being decided here
 * is only whether it is *offered*: it is a court-side surface — who is on court now, who is
 * free, who has been working since 9am — that most providers never staff for, so a permanent
 * top-level tab for it is clutter for the majority.
 *
 * That makes it a **preference, not a feature flag**, and the distinction is load-bearing in
 * two places this journey pins:
 *
 *  - It lives in the Options panel (formerly "Storage", which held a single checkbox), not
 *    in Beta features. Beta features means "unfinished, may change"; this is neither.
 *  - Switching it off must also stop the ROUTE answering, not merely hide the icon. A
 *    bookmark, a shared link or browser history all reach `/officials` directly, and a
 *    setting that leaves those working is the "checkbox does nothing" complaint again.
 *
 * There is no toast on that redirect, deliberately: `tabDenialReason` speaks for permissions,
 * and the user does not need their own choice explained back to them.
 */

const CHECKBOX = '#officialsBoard';
const LABEL = 'label[for="officialsBoard"]';

async function seedTournament(page: Page): Promise<string> {
  return page.evaluate(async () => {
    await dev.tmx2db.initDB();
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      nonRandom: 1,
      setState: true,
      tournamentName: 'E2E Officials Board Option',
      drawProfiles: [{ eventName: 'Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
    });
    await dev.tmx2db.addTournament(tournamentRecord);
    return tournamentRecord.tournamentId as string;
  });
}

async function openSettings(page: Page): Promise<string> {
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);
  await page.evaluate(() => localStorage.clear());
  const tournamentId = await seedTournament(page);
  await page.goto(`/#/tournament/${tournamentId}/settings`);
  await page.locator('#tournamentSettings .settings-panel').first().waitFor({ timeout: 15_000 });
  return tournamentId;
}

test('the option sits in Options, unchecked, and not among the beta features', async ({ page }) => {
  await openSettings(page);

  const optionsPanel = page.locator('.settings-panel').filter({ hasText: 'Options' }).first();
  await expect(optionsPanel).toBeVisible();
  // The panel kept its saveLocal checkbox when it was widened from "Storage" —
  // the control, so "the option is in Options" is not satisfied by a panel that
  // is merely titled Options and holds nothing else.
  await expect(optionsPanel.locator('#saveLocal')).toHaveCount(1);
  await expect(optionsPanel.locator(CHECKBOX)).toHaveCount(1);

  await expect(page.locator(CHECKBOX)).not.toBeChecked();

  // Not a beta feature. The Beta panel IS present (assistant proves it rendered),
  // so an absent checkbox there cannot pass by the panel having failed to draw.
  const betaPanel = page.locator('.settings-panel').filter({ hasText: 'Beta features' }).first();
  await expect(betaPanel.locator('#assistant')).toHaveCount(1);
  await expect(betaPanel.locator(CHECKBOX)).toHaveCount(0);
});

test('off by default, the Officials tab is neither shown nor reachable by URL', async ({ page }) => {
  const tournamentId = await openSettings(page);

  await expect(page.locator(S.NAV_OFFICIALS)).toBeHidden();
  // The control: a sibling nav icon IS visible, so "hidden" is a statement about
  // this icon and not about a nav rail that never rendered.
  await expect(page.locator(S.NAV_MATCHUPS)).toBeVisible();

  // The half that hiding an icon does not cover.
  await page.goto(`/#/tournament/${tournamentId}/officials`);
  await page.waitForSelector(S.TMX_CONTENT, { state: 'visible', timeout: 15_000 });
  await expect(page.locator(S.TOURNAMENT_OFFICIALS)).toBeHidden();
});

test('ticking it reveals the tab, and the choice survives a reload', async ({ page }) => {
  await openSettings(page);

  // `.is-checkradio` hides the real input and styles the label, so the label is
  // the actual user gesture; clicking the input fails as "not visible".
  await page.locator(LABEL).click();

  // The nav rail updates in place rather than waiting for the next tab render.
  await expect(page.locator(S.NAV_OFFICIALS)).toBeVisible();

  // Read from storage, not the DOM: the DOM is what the code just wrote, the
  // stored blob is what the next page load will believe.
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tmx_settings') ?? '{}'));
  expect(stored.officialsBoard).toBe(true);

  await page.reload();
  await waitForAppReady(page);
  await page.locator('#tournamentSettings .settings-panel').first().waitFor({ timeout: 15_000 });
  await expect(page.locator(CHECKBOX)).toBeChecked();
  await expect(page.locator(S.NAV_OFFICIALS)).toBeVisible();
});

test('the board actually opens once enabled — the option is not merely cosmetic', async ({ page }) => {
  const tournamentId = await openSettings(page);
  await page.locator(LABEL).click();
  await expect(page.locator(S.NAV_OFFICIALS)).toBeVisible();

  await page.goto(`/#/tournament/${tournamentId}/officials`);
  await expect(page.locator(S.TOURNAMENT_OFFICIALS)).toBeVisible({ timeout: 15_000 });
});

test('switching it back off hides the tab again and re-closes the route', async ({ page }) => {
  const tournamentId = await openSettings(page);
  await page.locator(LABEL).click();
  await expect(page.locator(S.NAV_OFFICIALS)).toBeVisible(); // the control — there is something to switch off

  await page.locator(LABEL).click();
  await expect(page.locator(S.NAV_OFFICIALS)).toBeHidden();

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tmx_settings') ?? '{}'));
  expect(stored.officialsBoard, 'an explicit opt-out is stored, not just absent').toBe(false);

  await page.goto(`/#/tournament/${tournamentId}/officials`);
  await page.waitForSelector(S.TMX_CONTENT, { state: 'visible', timeout: 15_000 });
  await expect(page.locator(S.TOURNAMENT_OFFICIALS)).toBeHidden();
});
