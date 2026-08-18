import { test, expect } from '@playwright/test';
import { initDevBridge, waitForAppReady } from '../helpers/dev-bridge';

/**
 * Journey 98 — overview Edit Dates modal pre-fills the tournament's time zone.
 *
 * The dates stat card right-justifies `localTimeZone` and click-throughs to the
 * Edit Dates modal. The modal's Time zone field must open showing the zone that
 * is already set — otherwise the TD sees an empty picker next to a card that
 * plainly displays a zone, and a blind [Save] reads as "clear the zone".
 *
 * The regression this guards: the field was wired only through the typeAhead's
 * `currentValue`, which resolves a stored code to its display label by looking
 * for `{ value, label }` entries in the list. The zone list is plain strings,
 * so the lookup never matched and the input rendered empty for every tournament
 * that had a zone set.
 */

const TIME_ZONE = 'Europe/Paris';
const TZ_INPUT = 'input[placeholder="e.g. America/New_York"]';

test.describe('Journey 98 — Edit Dates modal time zone pre-fill', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
  });

  test('an existing localTimeZone pre-fills the modal Time zone field', async ({ page }) => {
    const tournamentId = await page.evaluate(async (timeZone) => {
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        tournamentName: 'E2E Time Zone Prefill',
        nonRandom: 1,
      });
      // Set the zone on the record before load — `setTournamentLocalTimeZone`
      // is a server-gated mutation and this spec is only about how the modal
      // READS an already-set zone.
      tournamentRecord.localTimeZone = timeZone;
      dev.factory.tournamentEngine.setState(tournamentRecord);
      await dev.load(tournamentRecord);
      return tournamentRecord.tournamentId as string;
    }, TIME_ZONE);

    await page.goto(`/#/tournament/${tournamentId}/overview`);

    // Control: the dates card itself surfaces the zone. If this fails the
    // record never carried the zone and the modal assertion below would be
    // vacuously "empty field, empty record".
    const datesCard = page.locator('.dash-stats .dash-panel').first();
    await expect(datesCard).toContainText(TIME_ZONE, { timeout: 15_000 });

    await datesCard.click();

    const tzInput = page.locator(TZ_INPUT);
    await expect(tzInput).toBeVisible({ timeout: 10_000 });
    await expect(tzInput).toHaveValue(TIME_ZONE);
  });
});
