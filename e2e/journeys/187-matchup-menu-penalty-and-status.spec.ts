import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/**
 * Journey 187 — the matchUp actions menu's penalty and status items, offered where the factory's `matchUpActions`
 * offers PENALTY and STATUS.
 *
 * - Assess penalty records the chosen penalty against the chosen participant of the match.
 * - Change status opens the score entry dialog, which owns status changes, for a match still to be played; a
 *   completed match is not offered it.
 */

const MENU = '.tippy-content .menu-list';
const DIALOG = '.chc-modal-dialog';
const SCORE_DIALOG = '.chc-sec';

type Seeded = { tournamentId: string; matchUpId: string; sideName: string; otherName: string; otherId: string };

/** A draw of 8; with `completed`, the first match is completed 6-1 6-1. */
async function seed(page: Page, completed = false): Promise<Seeded> {
  return page.evaluate(async (completed) => {
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      tournamentAttributes: { tournamentId: 'e2e-menu-penalty-status' },
      drawProfiles: [{ drawSize: 8, eventName: 'Singles' }],
      tournamentName: 'E2E Menu Penalty And Status',
      nonRandom: 1,
      setState: true,
    });

    const engine = dev.factory.tournamentEngine;
    engine.setState(tournamentRecord);
    const matchUp = engine
      .allTournamentMatchUps()
      .matchUps.find((m: any) => m.roundNumber === 1 && m.roundPosition === 1);

    if (completed) {
      const { outcome } = dev.factory.mocksEngine.generateOutcomeFromScoreString({
        scoreString: '6-1 6-1',
        winningSide: 1,
      });
      const result = engine.setMatchUpStatus({ drawId: matchUp.drawId, matchUpId: matchUp.matchUpId, outcome });
      if (!result.success) throw new Error(`seed failed: ${JSON.stringify(result.error)}`);
    }

    const updated = engine.getTournament().tournamentRecord;
    await dev.load(updated);
    const side = (sideNumber: number) => matchUp.sides.find((s: any) => s.sideNumber === sideNumber).participant;
    return {
      tournamentId: updated.tournamentId as string,
      matchUpId: matchUp.matchUpId as string,
      // the loser: the winner's name is in the next round too
      sideName: side(2).participantName as string,
      otherName: side(1).participantName as string,
      otherId: side(1).participantId as string,
    };
  }, completed);
}

async function openMenu(page: Page, { tournamentId, sideName }: Seeded) {
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToMatchUps();

  const row = page
    .locator(`${S.TOURNAMENT_MATCHUPS} .tabulator-row`)
    .filter({ hasText: sideName })
    .filter({ hasText: 'Quarterfinal' })
    .first();
  await expect(row).toBeVisible({ timeout: 15_000 });

  const menu = page.locator(MENU);
  for (let attempt = 0; attempt < 4; attempt++) {
    await row.locator('.fa-ellipsis-vertical').click();
    if (await menu.isVisible().catch(() => false)) break;
  }
  await expect(menu).toBeVisible();
  return menu;
}

test.describe('Journey 187 — the matchUp menu: penalty and status', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('Assess penalty records the chosen penalty against the chosen participant', async ({ page }) => {
    const seeded = await seed(page);
    const menu = await openMenu(page, seeded);
    await menu.locator('li', { hasText: 'Assess penalty' }).click();

    const dialog = page.locator(DIALOG);
    await expect(dialog).toBeVisible();
    const [participant, penaltyType] = [dialog.locator('select').nth(0), dialog.locator('select').nth(1)];
    // both of the match's participants are offered
    await expect(participant.locator('option', { hasText: seeded.sideName })).toHaveCount(1);
    await participant.selectOption({ label: seeded.otherName });
    await penaltyType.selectOption('BALL_ABUSE');
    await dialog.locator('input').last().fill('Ball hit into the stands');
    await dialog.locator('button', { hasText: 'Assess' }).click();

    await expect
      .poll(() =>
        page.evaluate(() =>
          (dev.factory.tournamentEngine.getTournamentPenalties().penalties ?? []).map((penalty: any) => ({
            participantIds: penalty.participantIds,
            penaltyType: penalty.penaltyType,
            matchUpId: penalty.matchUpId,
            notes: penalty.notes,
          })),
        ),
      )
      .toEqual([
        {
          participantIds: [seeded.otherId],
          penaltyType: 'BALL_ABUSE',
          matchUpId: seeded.matchUpId,
          notes: 'Ball hit into the stands',
        },
      ]);
  });

  test('Change status opens score entry for a match still to be played', async ({ page }) => {
    const seeded = await seed(page);
    const menu = await openMenu(page, seeded);
    await menu.locator('li', { hasText: 'Change Status' }).click();
    await expect(page.locator(SCORE_DIALOG)).toBeVisible();
  });

  test('a completed match keeps Assess penalty and is not offered Change status', async ({ page }) => {
    const seeded = await seed(page, true);
    const menu = await openMenu(page, seeded);
    await expect(menu.locator('li', { hasText: 'Assess penalty' })).toHaveCount(1);
    await expect(menu.locator('li', { hasText: 'Change Status' })).toHaveCount(0);
  });
});
