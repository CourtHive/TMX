import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect } from '@playwright/test';
import { seedTournament } from '../helpers/seed';

declare const dev: any;

/**
 * Journey 197 — local mode's "complete matchUps" icon offers all remaining, or through a chosen round (CA,
 * 2026-11-08). Hovering a round previews what it completes; choosing one completes through it and stops.
 */
test.describe('Journey 197 — complete matchUps through a round', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('preview, complete through the semifinal, then all remaining', async ({ page }) => {
    const tournamentId = await seedTournament(page, {
      tournamentAttributes: { tournamentId: 'e2e-complete-through-round' },
      drawProfiles: [{ drawSize: 16 }],
    });
    const { eventId, drawId } = await page.evaluate(() => {
      const event = dev.getTournament().events[0];
      return { eventId: event.eventId, drawId: event.drawDefinitions[0].drawId };
    });
    const openByRound = () =>
      page.evaluate((drawId) => {
        const matchUps = dev.factory.tournamentEngine.allDrawMatchUps({ drawId }).matchUps;
        return [1, 2, 3, 4].map((rn) => matchUps.filter((m: any) => m.roundNumber === rn && !m.winningSide).length);
      }, drawId);

    await page.goto(`/#/tournament/${tournamentId}/event/${eventId}/draw/${drawId}`);
    const icon = page.locator('i.fa-check-double').first();
    await expect(icon).toBeVisible({ timeout: 10_000 });

    const popover = page.locator('.tmx-complete-matchups');
    const round = (label: string) => popover.locator('.tmx-cm-round', { hasText: label });
    const caption = popover.locator('.tmx-cm-through .tmx-cm-caption');

    await icon.click();
    await expect(popover.locator('.tmx-cm-all .tmx-cm-count')).toHaveText('15');
    await expect(popover.locator('.tmx-cm-round-name')).toHaveText(['R16', 'QF', 'SF', 'F']);
    // opened on the next round, focused for the keyboard
    await expect(round('R16')).toBeFocused();
    await expect(caption).toHaveText('Completes R16 · 8 matchUps');

    // hovering the semifinal lights the three rounds it would complete
    await round('SF').hover();
    await expect(caption).toHaveText('Completes R16 through SF · 14 matchUps');
    await expect(popover.locator('.tmx-cm-round[data-lit="true"]')).toHaveCount(3);
    // both themes: the stepper's colours are theme tokens
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => document.documentElement.setAttribute('data-theme', theme), theme);
      // let the theme's colour transitions finish before the capture
      const boxBackground = () =>
        page.evaluate(() => getComputedStyle(document.querySelector('.tippy-box') as Element).backgroundColor);
      let settled = '';
      await expect
        .poll(async () => {
          const previous = settled;
          settled = await boxBackground();
          return settled === previous;
        })
        .toBe(true);
      await popover.screenshot({ path: test.info().outputPath(`preview-${theme}.png`) });
    }

    // the icon toggles the popover
    await icon.click();
    await expect(popover).toHaveCount(0);
    await icon.click();
    await expect(popover).toBeVisible();

    // through the next round only
    await round('R16').click();
    await expect.poll(openByRound).toEqual([0, 4, 2, 1]);

    // R16 now reads as done; the stepper opens on the quarterfinal
    await expect(icon).toBeVisible({ timeout: 10_000 });
    await icon.click();
    await expect(round('R16')).toHaveAttribute('data-open', 'false');
    await expect(round('R16')).toBeDisabled();
    await expect(round('QF')).toBeFocused();
    await expect(caption).toHaveText('Completes QF · 4 matchUps');
    await round('SF').hover();
    await expect(caption).toHaveText('Completes QF through SF · 6 matchUps');
    await popover.screenshot({ path: test.info().outputPath('r16-done.png') });

    await round('SF').click();
    await expect.poll(openByRound).toEqual([0, 0, 0, 1]);

    // one round left: "through it" is "all remaining", so only that is offered
    await expect(icon).toBeVisible({ timeout: 10_000 });
    await icon.click();
    await expect(popover.locator('.tmx-cm-all .tmx-cm-count')).toHaveText('1');
    await expect(popover.locator('.tmx-cm-through')).toHaveCount(0);
    await popover.locator('.tmx-cm-all').click();
    await expect.poll(openByRound).toEqual([0, 0, 0, 0]);

    await expect(icon).toBeVisible({ timeout: 10_000 });
    await icon.click();
    await expect(popover).toContainText('Every matchUp in this structure is complete');
    // Escape closes it, and the icon's tooltip is back
    await page.keyboard.press('Escape');
    await expect(popover).toHaveCount(0);
  });
});
