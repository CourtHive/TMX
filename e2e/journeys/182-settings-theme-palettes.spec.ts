import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';

/**
 * Journey 182 — a light palette and a dark palette, chosen in Settings like a language.
 *
 * The mode (light / dark / system) sets `data-theme`; the palette chosen for THAT mode sets `data-palette`.
 * Courtside and Midnight are the defaults. A choice must apply at once when its mode is showing, wait
 * quietly when it is not, and survive a reload — including the first paint, which theme-init.js handles
 * before the bundle loads.
 */

const MODE = '#themeMode select, select#themeMode';
const LIGHT = '#lightPalette select, select#lightPalette';
const DARK = '#darkPalette select, select#darkPalette';

const attrs = (page: Page) =>
  page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    palette: document.documentElement.dataset.palette,
    bg: getComputedStyle(document.documentElement).getPropertyValue('--chc-bg-primary').trim(),
  }));

async function openSettings(page: Page): Promise<void> {
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);
  await page.evaluate(() => localStorage.clear());

  // Direct IDB write (journey 81's pattern) so the /settings goto isn't overridden by dev.load.
  const tournamentId = await page.evaluate(async () => {
    await dev.tmx2db.initDB();
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      drawProfiles: [{ eventName: 'Singles', drawSize: 8 }],
      tournamentName: 'E2E Theme Palettes',
      nonRandom: 1,
      setState: true,
    });
    await dev.tmx2db.addTournament(tournamentRecord);
    return tournamentRecord.tournamentId as string;
  });

  await page.goto(`/#/tournament/${tournamentId}/settings`);
  await page.locator(LIGHT).waitFor({ timeout: 15_000 });
}

test.describe('Journey 182 — settings theme palettes', () => {
  test('defaults are Courtside (light) and Midnight (dark)', async ({ page }) => {
    await openSettings(page);
    await page.selectOption(MODE, 'light');
    expect(await attrs(page)).toMatchObject({ theme: 'light', palette: 'courtside' });
    await expect(page.locator(LIGHT)).toHaveValue('courtside');
    await expect(page.locator(DARK)).toHaveValue('midnight');

    await page.selectOption(MODE, 'dark');
    expect(await attrs(page)).toMatchObject({ theme: 'dark', palette: 'midnight' });
  });

  test('a palette for the showing mode applies at once; the other mode waits', async ({ page }) => {
    await openSettings(page);
    await page.selectOption(MODE, 'light');
    const before = await attrs(page);

    await page.selectOption(LIGHT, 'linen');
    const linen = await attrs(page);
    expect(linen).toMatchObject({ theme: 'light', palette: 'linen' });
    // Falsifiable: the token actually changed, not just the attribute.
    expect(linen.bg).not.toBe(before.bg);

    // Choosing a dark palette while light is showing must not touch the page.
    await page.selectOption(DARK, 'graphite');
    expect(await attrs(page)).toMatchObject({ theme: 'light', palette: 'linen' });

    // Switching mode shows the stored dark choice.
    await page.selectOption(MODE, 'dark');
    expect(await attrs(page)).toMatchObject({ theme: 'dark', palette: 'graphite' });
  });

  test('choices survive a reload, applied before the bundle by theme-init.js', async ({ page }) => {
    await openSettings(page);
    await page.selectOption(MODE, 'dark');
    await page.selectOption(DARK, 'graphite');

    // Block the app bundle so only theme-init.js can have set the attributes — otherwise the bundle's own
    // applyTheme would satisfy this assertion and a broken pre-paint script would go unnoticed.
    await page.route('**/src/main.ts*', (route) => route.abort());
    await page.reload();
    expect(await attrs(page)).toMatchObject({ theme: 'dark', palette: 'graphite' });
    await page.unroute('**/src/main.ts*');

    await page.reload();
    await waitForAppReady(page);
    expect(await attrs(page)).toMatchObject({ theme: 'dark', palette: 'graphite' });
  });
});
