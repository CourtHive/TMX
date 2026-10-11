import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';
import { seedTournament } from '../helpers/seed';
import { S } from '../helpers/selectors';

/**
 * Journey 155 — with hotkey scoring on, a points total opens the score dialog instead of the keypad.
 *
 * Hotkey scoring (`dev.env.hotkeys = true`, never on mobile) turns a matchUps-table score cell into a keypad
 * driven by the factory's `keyValueScore`: one digit is the losing side's games, the winner's filled in. That
 * cannot enter a combined-point total — on `SET1-S:P32` typing 1 gives "-1" and further digits are ignored —
 * so neither 16–16 nor 17–15 could be scored. A points-total matchUp now opens the score dialog, which takes
 * the total and a tie (Mentat TASKS.md, the points-total tie follow-ups).
 *
 *  - a P32 round-robin matchUp opens the score dialog;
 *  - control: a tennis matchUp in the same tournament still arms the keypad (no dialog, the cell marked active).
 */

const SCORE_DIALOG = '.chc-sec';
const ACTIVE_CELL = '.activeScoreCell';

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);
  await page.evaluate(() => {
    (dev as any).env.hotkeys = true;
  });
}

function scoreCell(page: Page, eventName: string) {
  return page
    .locator(`${S.TOURNAMENT_MATCHUPS} .tabulator-row`, { hasText: eventName })
    .first()
    .locator('.tabulator-cell[tabulator-field="scoreDetail"]');
}

test.describe('journey 155 — hotkey scoring and points totals', () => {
  test.beforeEach(async ({ page }) => {
    await boot(page);
  });

  test('a points total opens the score dialog; a tennis matchUp still arms the keypad', async ({ page }) => {
    const tournamentId = await seedTournament(page, {
      tournamentName: 'E2E Hotkeys Points Total',
      tournamentAttributes: { tournamentId: 'e2e-hotkeys-points-total' },
      participantsProfile: { scaledParticipantsCount: 16 },
      drawProfiles: [
        { eventName: 'Americano', drawType: 'ROUND_ROBIN', drawSize: 4, matchUpFormat: 'SET1-S:P32' },
        { eventName: 'Tennis', drawType: 'SINGLE_ELIMINATION', drawSize: 4 },
      ],
    });
    expect(await page.evaluate(() => (dev as any).env.hotkeys)).toBe(true);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToMatchUps();
    await expect(page.locator(S.TOURNAMENT_MATCHUPS)).toBeVisible();

    // control first: the keypad arms on a tennis matchUp, and no dialog opens
    await scoreCell(page, 'Tennis').click();
    await expect(page.locator(ACTIVE_CELL)).toHaveCount(1);
    await expect(page.locator(SCORE_DIALOG)).toHaveCount(0);

    // the points total opens the dialog
    await scoreCell(page, 'Americano').click();
    await expect(page.locator(SCORE_DIALOG)).toBeVisible();
  });
});
