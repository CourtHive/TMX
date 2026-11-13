import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect } from '@playwright/test';

/**
 * Journey 207 — the schedule date-selector popover shows the date AFTER the selected one.
 *
 * Regression guard: on open, the popover scrolled the selected chip into view with
 * `scrollIntoView({ block: 'nearest' })`, which pinned it to the bottom edge of the
 * scroller — later dates existed but nothing in view said so. The selector now centers
 * the selected chip in the popover's own scroller, so its neighbours on both sides are
 * visible.
 *
 * Fixed dates (not today-relative) and an explicit date in the route keep the journey
 * independent of the clock and the venue's timezone.
 */

const TOURNAMENT_ID = 'e2e-date-popover-next-date';
const START_DATE = '2026-06-01';
const END_DATE = '2026-06-21';
const SELECTED_DATE = '2026-06-15';
const NEXT_DATE = '2026-06-16';
const PREVIOUS_DATE = '2026-06-14';

/**
 * Runs in the browser against the selected chip: does its scroller scroll, and are the
 * chips on either side of it wholly inside the scroller's visible box?
 */
function neighbourVisibility(chip: HTMLElement): { scrolls: boolean; next: boolean; previous: boolean } {
  const scroller = chip.parentElement as HTMLElement;
  const box = scroller.getBoundingClientRect();
  const isWhollyVisible = (el: Element | null): boolean => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.top >= box.top && r.bottom <= box.bottom;
  };
  return {
    scrolls: scroller.scrollHeight > scroller.clientHeight,
    next: isWhollyVisible(chip.nextElementSibling),
    previous: isWhollyVisible(chip.previousElementSibling),
  };
}

test.describe('Journey 207 — schedule date popover shows the next date', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('the selected date opens centered, with its neighbours fully visible', async ({ page }) => {
    await page.evaluate(
      async ({ tournamentId, startDate, endDate }) => {
        await dev.tmx2db.initDB();
        const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
          nonRandom: 1,
          tournamentName: 'E2E Date Popover Next Date',
          tournamentAttributes: { tournamentId, startDate, endDate },
          drawProfiles: [{ eventName: 'Singles', drawSize: 4 }],
        });
        await dev.tmx2db.addTournament(tournamentRecord);
      },
      { tournamentId: TOURNAMENT_ID, startDate: START_DATE, endDate: END_DATE },
    );

    await page.goto(`/#/tournament/${TOURNAMENT_ID}/scheduling/${SELECTED_DATE}/grid`);

    const dateButton = page.locator('button:has(i.fa-calendar-days)').first();
    await expect(dateButton).toBeVisible({ timeout: 15_000 });
    await dateButton.click();

    const selected = page.locator(`.tippy-box [data-date="${SELECTED_DATE}"]`);
    await expect(selected).toBeVisible();

    // 21 dates cannot fit in the 320px popover, so it must scroll; the selected chip is
    // late enough that the old 'nearest' behaviour would have pinned it to the bottom.
    await expect
      .poll(() => selected.evaluate(neighbourVisibility))
      .toEqual({ scrolls: true, next: true, previous: true });

    await expect(page.locator(`.tippy-box [data-date="${NEXT_DATE}"]`)).toBeInViewport();
    await expect(page.locator(`.tippy-box [data-date="${PREVIOUS_DATE}"]`)).toBeInViewport();
  });
});
