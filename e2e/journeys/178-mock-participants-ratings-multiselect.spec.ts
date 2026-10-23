import { test, expect, type Locator, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, PROFILE_EMPTY_TOURNAMENT } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/**
 * Journey 178 — the ratings multi-select in "Generate mock participants" opens OVER the footer.
 *
 * #596(courthive-components) made `.chc-modal-body` the dialog's scroll region, and a scrolling element
 * clips everything absolutely positioned inside it. The multi-select's checkbox panel hangs below its
 * trigger, so in this short modal it was cut off at the body's edge: one row showed above the footer and
 * nothing said there were more. The fix anchors the open panel with `position: fixed`
 * (`anchorModalPopups`) and bounds it by the window instead, opening upward when below is cramped.
 *
 * Every row is judged by `elementFromPoint`, not `toBeVisible`: Playwright counts a clipped element as
 * visible, so a visibility assertion passes against the bug.
 */

const MODAL = '.chc-modal-dialog';
const PANEL = `${MODAL} .chc-multi-select-dropdown`;
const TALL = { width: 1440, height: 900 };
const SHORT = { width: 1280, height: 720 };

async function openRatingsPanel(page: Page, tournamentId: string): Promise<{ modal: Locator; panel: Locator }> {
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await page.locator(S.NAV_PARTICIPANTS).click();
  await page.waitForSelector(`${S.TOURNAMENT_PARTICIPANTS} .tabulator-row`, { timeout: 15_000 });

  await page.getByRole('button', { name: 'Generate mock participants' }).click();
  const modal = page.locator(MODAL);
  await expect(modal).toBeVisible();

  const panel = page.locator(PANEL);
  await panel.locator('xpath=preceding-sibling::*[1]').click();
  await expect(panel).toBeVisible();
  return { modal, panel };
}

/** The rows whose centre, inside the panel's own scroll window, is drawn by something else. */
function coveredRows(page: Page): Promise<string[]> {
  return page.evaluate((selector) => {
    const panel = document.querySelector<HTMLElement>(selector)!;
    const { top: panelTop, bottom: panelBottom } = panel.getBoundingClientRect();
    return [...panel.querySelectorAll<HTMLElement>('label')]
      .filter((row) => {
        const { left, right, top, bottom } = row.getBoundingClientRect();
        const middle = (top + bottom) / 2;
        // Rows outside the panel's own max-height are scrolled inside it, not clipped by the body.
        if (middle <= panelTop || middle >= panelBottom) return false;
        const hit = document.elementFromPoint((left + right) / 2, middle);
        return !hit || !row.contains(hit);
      })
      .map((row) => row.textContent ?? '');
  }, PANEL);
}

async function box(locator: Locator) {
  const rect = await locator.boundingBox();
  if (!rect) throw new Error('no bounding box');
  return { ...rect, bottom: rect.y + rect.height };
}

test.describe('Journey 178 — mock participants ratings multi-select', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('the open ratings panel is drawn over the footer, every row of it', async ({ page }) => {
    await page.setViewportSize(TALL);
    const tournamentId = await seedTournament(page, PROFILE_EMPTY_TOURNAMENT);
    const { modal, panel } = await openRatingsPanel(page, tournamentId);

    // The premise: the panel reaches past the body into the footer. Without it the coverage check
    // below could pass on a modal tall enough never to have clipped anything.
    const footer = await box(modal.locator('.chc-modal-footer'));
    const panelBox = await box(panel);
    expect(panelBox.bottom, 'the panel reaches past the body').toBeGreaterThan(footer.y);

    // More than one row is showing: the bug showed exactly one.
    expect(await panel.locator('label').count()).toBeGreaterThan(1);
    expect(await coveredRows(page), 'every visible row is drawn on top').toEqual([]);

    // The panel hangs from the trigger at the trigger's width.
    const trigger = await box(panel.locator('xpath=preceding-sibling::*[1]'));
    expect(Math.round(panelBox.y)).toBe(Math.round(trigger.bottom));
    expect(Math.round(panelBox.width)).toBe(Math.round(trigger.width));
  });

  test('in a short window the panel stays inside it, and its last rating can be generated', async ({ page }) => {
    await page.setViewportSize(SHORT);
    const tournamentId = await seedTournament(page, PROFILE_EMPTY_TOURNAMENT);
    const { modal, panel } = await openRatingsPanel(page, tournamentId);

    // Inside the window, beside the trigger (below it, or above it when below is cramped).
    const panelBox = await box(panel);
    const trigger = await box(panel.locator('xpath=preceding-sibling::*[1]'));
    expect(panelBox.y, 'the panel starts inside the window').toBeGreaterThanOrEqual(0);
    expect(panelBox.bottom, 'the panel ends inside the window').toBeLessThanOrEqual(SHORT.height);
    const touches = [Math.round(panelBox.y - trigger.bottom), Math.round(trigger.y - panelBox.bottom)];
    expect(touches, 'the panel hangs from its trigger').toContain(0);
    expect(await coveredRows(page), 'every visible row is drawn on top').toEqual([]);

    // The LAST rating: hanging off the bottom of the window before the panel was bounded by it.
    const row = panel.locator('label').last();
    await row.scrollIntoViewIfNeeded();
    const ratingType = (await row.textContent())!.trim();
    await row.click();
    await expect(row.locator('input[type="checkbox"]')).toBeChecked();

    await modal.getByRole('button', { name: 'Generate' }).click();
    await expect(modal).toBeHidden();

    // The chosen rating reached the generated participants.
    await expect
      .poll(() =>
        page.evaluate((scaleName) => {
          const { participants } = dev.factory.tournamentEngine.getParticipants({ withScaleValues: true });
          return participants.filter((participant: any) =>
            (participant.ratings?.SINGLES ?? []).some((rating: any) => rating.scaleName === scaleName),
          ).length;
        }, ratingType),
      )
      .toBeGreaterThan(0);
  });
});
