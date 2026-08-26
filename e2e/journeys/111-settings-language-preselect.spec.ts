import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';

/**
 * Journey 111 — Settings must open on the language the interface is actually rendering.
 *
 * Reported symptom: opening Settings for the first time showed Arabic, and changing ANY other
 * setting switched the whole interface to Arabic with no explanation.
 *
 * `resolveBootLanguage` passes `navigator.language` to `changeLanguage`, so `i18next.language` is
 * region-tagged (`en-US`). Translations still resolve through `fallbackLng: 'en'` — the UI reads
 * English and nothing looks wrong — but no manifest code equals `en-US`, so no option was marked
 * selected and a `<select>` with nothing selected displays its first option. The manifest is
 * alphabetical, so that was `ar`. `persistAll` then read the control's value on any save and wrote
 * it as an EXPLICIT language choice before reloading.
 *
 * Playwright's default context locale is `en-US`, which is exactly the reproducing condition.
 */

const LANGUAGE_SELECT = '#language select, select#language';

/**
 * The live CFS manifest, served in its real alphabetical order. Stubbed because the preview server
 * has no CFS behind it: without this the picker renders a SINGLE option (`en`, the bundled locale
 * i18next already holds), and a one-option select reads `en` whether or not the matching rule is
 * correct — the assertions below would pass against the very bug they exist to catch.
 */
const MANIFEST = {
  locales: [
    { code: 'ar', nativeLabel: 'العربية' },
    { code: 'cs', nativeLabel: 'Čeština' },
    { code: 'de', nativeLabel: 'Deutsch' },
    { code: 'en', nativeLabel: 'English' },
    { code: 'es', nativeLabel: 'Español' },
    { code: 'fr', nativeLabel: 'Français' },
    { code: 'hr', nativeLabel: 'Hrvatski' },
    { code: 'pt-BR', nativeLabel: 'Português (Brasil)' },
    { code: 'zh-CN', nativeLabel: '简体中文' },
  ],
};

async function seedAndOpenSettings(page: Page): Promise<void> {
  await page.route('**/i18n/manifest*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MANIFEST) }),
  );
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);
  await page.evaluate(() => localStorage.clear());

  // Direct IDB write (journey 81's pattern) so the /settings goto isn't overridden by dev.load.
  const tournamentId = await page.evaluate(async () => {
    await dev.tmx2db.initDB();
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      drawProfiles: [{ eventName: 'Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
      participantsProfile: { scaledParticipantsCount: 8 },
      tournamentName: 'E2E Settings Language',
      nonRandom: 1,
      setState: true,
    });
    await dev.tmx2db.addTournament(tournamentRecord);
    return tournamentRecord.tournamentId as string;
  });

  await page.goto(`/#/tournament/${tournamentId}/settings`);
  await page.locator('#tournamentSettings .settings-panel').first().waitFor({ timeout: 15_000 });
}

test.describe('Journey 111 — settings language preselect', () => {
  test('opens on English rather than the first option in the list', async ({ page }) => {
    await seedAndOpenSettings(page);

    // The reproducing condition, asserted rather than assumed: the app is running a region-tagged
    // language that appears nowhere in the locale manifest.
    const active = await page.evaluate(
      () => (globalThis as any).dev?.i18next?.language ?? document.documentElement.lang,
    );
    expect(active).toMatch(/^en/);

    const select = page.locator(LANGUAGE_SELECT).first();
    await expect(select).toBeVisible({ timeout: 10_000 });

    // Control: the picker must actually be offering the full list, with Arabic first. Without this
    // the value assertion below is vacuous — a single-option select reads 'en' regardless.
    const options = await select.locator('option').evaluateAll((els) => els.map((el: any) => el.value));
    expect(options.length).toBeGreaterThan(1);
    expect(options[0]).toBe('ar');

    // The regression: this read 'ar', because nothing was selected and Arabic sorts first.
    await expect(select).toHaveValue('en');
  });

  test('changing an unrelated setting does not switch the interface language', async ({ page }) => {
    await seedAndOpenSettings(page);

    expect(await page.evaluate(() => document.documentElement.lang)).toMatch(/^en/);
    expect(await page.evaluate(() => document.documentElement.dir)).toBe('ltr');

    // Toggle something with nothing to do with language. Before the fix this persisted the language
    // the control happened to be showing — Arabic — as an explicit choice, and reloaded into it.
    // `saveLocal` is deliberately chosen: it persists through the same `persistAll` path but is not
    // one of the settings that legitimately triggers a reload, so any reload here is the bug.
    // The input itself is visually hidden by `is-checkradio`, so drive its label as a user would.
    const toggle = page.locator('#tournamentSettings label[for="saveLocal"]').first();
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    await toggle.click();
    await page.waitForTimeout(1200); // a reload, if one is coming, happens well inside this

    await page.locator('#tournamentSettings .settings-panel').first().waitFor({ timeout: 15_000 });

    // RTL is the loudest tell: Arabic would flip the document direction.
    expect(await page.evaluate(() => document.documentElement.dir)).toBe('ltr');
    expect(await page.evaluate(() => document.documentElement.lang)).toMatch(/^en/);
    await expect(page.locator(LANGUAGE_SELECT).first()).toHaveValue('en');

    // And nothing was recorded as a deliberate language choice.
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('tmx.settings') ?? localStorage.getItem('settings') ?? '{}';
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    });
    expect(stored.language ?? 'en').not.toBe('ar');
  });
});
