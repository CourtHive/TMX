import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 79 — tippy `dynContent` plugin emits no invalid-prop warning.
 *
 * The sidebar navigation tooltips pass a custom `dynContent` prop backed by the
 * `enhancedContentFunction` plugin. The plugin previously lacked a top-level
 * `name`, so tippy's dev-only `validateProps` warned "`dynContent` is not a
 * valid prop" on the first tooltip instance. Aligning the plugin's top-level
 * `name` with the prop name silences it without changing behavior.
 *
 * CRITICAL: tippy's `warnWhen` dedupes via a module-level `visitedMessages` Set
 * — it warns ONCE per unique message for the whole page lifetime. The first nav
 * render (the home sidebar on app boot) is what fires it, so the console
 * listener MUST be attached before the very first navigation or the warning is
 * already "visited" and suppressed (a false negative). Hence no navigation in
 * beforeEach — everything is driven here after the listener is live.
 *
 * The plugin's lazy-content contract is unit-tested in
 * `services/dom/toolTip/plugins.test.ts`.
 */

const INVALID_PROP_MARKER = 'is not a valid prop';
const DYNCONTENT_MARKER = 'dynContent';

async function seedTournament(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(async () => {
    await dev.tmx2db.initDB();
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      nonRandom: 1,
      setState: true,
      tournamentName: 'E2E Tippy DynContent',
      tournamentAttributes: { tournamentId: 'e2e-tippy-dyncontent' },
      drawProfiles: [{ eventName: 'Singles', drawSize: 4, drawType: 'SINGLE_ELIMINATION' }],
    });
    await dev.tmx2db.addTournament(dev.factory.tournamentEngine.getTournament().tournamentRecord);
    return tournamentRecord.tournamentId as string;
  });
}

test.describe('Journey 79 — tippy dynContent no invalid-prop warning', () => {
  test('nav tooltips render without a dynContent invalid-prop warning', async ({ page }) => {
    // Attach the console listener BEFORE any navigation — the warning fires once
    // on the first nav render and tippy suppresses repeats.
    const warnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'warning' || msg.type() === 'error') warnings.push(msg.text());
    });

    // App boot renders the home sidebar nav (homeNavigation.ts → dynContent
    // tooltips); this is the first place the warning would fire.
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);

    // Also exercise the tournament nav (navigation.ts → dynContent tooltips).
    const tournamentId = await seedTournament(page);
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await expect(page.locator('#o-route')).toBeVisible();

    // Give console messages a tick to flush to the Playwright listener.
    await page.waitForTimeout(500);

    const dynContentWarnings = warnings.filter(
      (w) => w.includes(INVALID_PROP_MARKER) && w.includes(DYNCONTENT_MARKER),
    );
    expect(dynContentWarnings, `Unexpected tippy warnings:\n${dynContentWarnings.join('\n')}`).toHaveLength(0);

    // Belt-and-braces: no tippy invalid-prop warning of any kind slipped in.
    expect(warnings.filter((w) => w.includes(INVALID_PROP_MARKER))).toHaveLength(0);
  });
});
