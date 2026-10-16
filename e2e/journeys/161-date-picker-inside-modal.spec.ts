import { test, expect, type Locator } from '@playwright/test';
import { initDevBridge, waitForAppReady } from '../helpers/dev-bridge';

/**
 * Journey 161 — the Edit Dates calendar, and the time zone suggestions, draw over the modal's footer.
 *
 * The modal body scrolls (`.chc-modal-body { overflow-y: auto }`, courthive-components #596), and a scrolling
 * element clips everything absolutely positioned inside it. The datepicker's calendar opened below "Start date"
 * and its lower half was cut off under the footer: the TD had to scroll the body to see the whole month
 * (reported 2026-10-15). The time zone type-ahead's suggestions ran under the footer the same way. cModal now
 * draws both popups `position: fixed`, anchored to their inputs.
 *
 * Visibility is judged by what is actually drawn at a point (`elementFromPoint`): `toBeVisible` counts a
 * clipped element as visible, and a click would pass too, because it scrolls the body first.
 */

const TZ_INPUT = 'input[placeholder="e.g. America/New_York"]';
const OPEN_CALENDAR = '.datepicker-dropdown.active';
const SUGGESTIONS = 'ul[role="listbox"]:not([hidden]) li';

/** Whether a point a few pixels inside each corner of the element shows the element itself. */
function cornersOnTop(locator: Locator): Promise<boolean[]> {
  return locator.evaluate((element) => {
    const { left, right, top, bottom } = element.getBoundingClientRect();
    const inset = 4;
    const corners: [number, number][] = [
      [left + inset, top + inset],
      [right - inset, top + inset],
      [left + inset, bottom - inset],
      [right - inset, bottom - inset],
    ];
    return corners.map(([x, y]) => {
      const drawn = document.elementFromPoint(x, y);
      return !!drawn && element.contains(drawn);
    });
  });
}

test.describe('Journey 161 — popups inside the Edit Dates modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);

    const tournamentId = await page.evaluate(async () => {
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        tournamentName: 'E2E Date Picker In Modal',
        nonRandom: 1,
      });
      dev.factory.tournamentEngine.setState(tournamentRecord);
      await dev.load(tournamentRecord);
      return tournamentRecord.tournamentId as string;
    });

    await page.goto(`/#/tournament/${tournamentId}/overview`);
    await page.locator('.dash-stats .dash-panel').first().click();
    await expect(page.locator(TZ_INPUT)).toBeVisible({ timeout: 10_000 });
  });

  test('the Start date calendar is drawn whole, over the footer', async ({ page }) => {
    const footer = page.locator('.chc-modal-footer');
    await page.locator('.chc-modal-body input').first().click();

    const calendar = page.locator(OPEN_CALENDAR);
    await expect(calendar).toHaveCount(1);

    // Control: the calendar really does reach past the top of the footer, so the corners below are a test of
    // what covers what, not a calendar that happens to fit inside the body.
    const calendarBottom = await calendar.evaluate((element) => element.getBoundingClientRect().bottom);
    const footerTop = await footer.evaluate((element) => element.getBoundingClientRect().top);
    expect(calendarBottom).toBeGreaterThan(footerTop);

    expect(await cornersOnTop(calendar)).toEqual([true, true, true, true]);
  });

  test('every time zone suggestion is drawn on top, and the body does not grow to hold them', async ({ page }) => {
    const body = page.locator('.chc-modal-body');
    const bodyHeight = () => body.evaluate((element) => element.getBoundingClientRect().height);
    const before = await bodyHeight();

    const input = page.locator(TZ_INPUT);
    await input.fill('America');
    const items = page.locator(SUGGESTIONS);
    await expect.poll(() => items.count()).toBeGreaterThanOrEqual(5);

    // Awesomplete scales the list in from zero, and a scaled row's centre is still inside the row: wait until
    // the list's drawn width equals its layout width, which ignores transforms.
    const list = page.locator('ul[role="listbox"]:not([hidden])');
    await expect
      .poll(() =>
        list.evaluate(
          (element) => Math.round(element.getBoundingClientRect().width) === (element as HTMLElement).offsetWidth,
        ),
      )
      .toBe(true);

    const covered = await items.evaluateAll((rows) =>
      rows
        .filter((row) => {
          const { left, right, top, bottom } = row.getBoundingClientRect();
          const drawn = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
          return !drawn || !row.contains(drawn);
        })
        .map((row) => row.textContent),
    );
    expect(covered).toEqual([]);
    expect(await bodyHeight()).toBe(before);
  });
});
