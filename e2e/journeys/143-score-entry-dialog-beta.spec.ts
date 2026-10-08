import { initDevBridge, resetState, seedFeatureFlagInitScript, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';

/**
 * Journey 143 — the new score entry dialog (beta flag, ON by default) records a result through the engine.
 *
 * CA, 2026-10-08: *"is the new score entry exported such that we could add it to TMX with a beta
 * flag?"* It is, and this is the flag. The dialog (courthive-components `openScoreEntryDialog`) reports
 * an outcome already in the shape `setMatchUpStatus` reads, so TMX forwards it as is. Asserted here,
 * through the app's real entry point (`dev.enterMatchUpScore` is `enterMatchUpScore`, not a stand-in):
 *  1. with the flag OFF the shipped modal opens and the new dialog does not;
 *  2. with the flag ON the new dialog opens, a result typed under Dynamic Sets reaches the matchUp as
 *     COMPLETED with both sets and the winner, and the dialog closes.
 */
const NEW_DIALOG = '.chc-sec';
const NEW_DIALOG_SUBMIT = '.chc-sec-btn-primary';
const NEW_DIALOG_INPUT = (set: number, side: number) =>
  `input.chc-sec-set-input[data-set="${set}"][data-side="${side}"]`;
const OLD_MODAL_SUBMIT = '#submitScoreV2';

type Seeded = { tournamentId: string; matchUpId: string };
type Recorded = { matchUpStatus?: string; winningSide?: number; sets: { side1Score?: number; side2Score?: number }[] };

async function seedTournament(page: Page, tournamentId: string): Promise<Seeded> {
  return page.evaluate(async (tournamentId) => {
    await dev.tmx2db.initDB();
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      drawProfiles: [{ eventName: 'Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
      tournamentAttributes: { tournamentId },
      tournamentName: 'E2E Score Entry Dialog',
      setState: true,
      nonRandom: 1,
    });
    await dev.load({ tournamentRecord });
    const matchUp: any = (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).find(
      (m: any) => m.matchUpStatus !== 'BYE' && m.roundNumber === 1,
    );
    if (!matchUp) throw new Error('seedTournament: no round-1 matchUp');
    return { tournamentId: tournamentRecord.tournamentId, matchUpId: matchUp.matchUpId };
  }, tournamentId);
}

async function readRecorded(page: Page, matchUpId: string): Promise<Recorded> {
  return page.evaluate((id) => {
    const m: any = (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).find(
      (x: any) => x.matchUpId === id,
    );
    return {
      matchUpStatus: m?.matchUpStatus,
      winningSide: m?.winningSide,
      sets: (m?.score?.sets ?? []).map((s: any) => ({ side1Score: s.side1Score, side2Score: s.side2Score })),
    };
  }, matchUpId);
}

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);
}

test.describe('journey 143 — score entry dialog behind the beta flag', () => {
  test('by default the new dialog opens, with no flag set — CA: "automatically checked by default"', async ({
    page,
  }) => {
    await boot(page);
    const { matchUpId } = await seedTournament(page, 'e2e-score-entry-default');

    await page.evaluate((id) => (dev as any).enterMatchUpScore({ matchUpId: id }), matchUpId);

    await expect(page.locator(NEW_DIALOG)).toBeVisible();
    await expect(page.locator(OLD_MODAL_SUBMIT)).toHaveCount(0);
  });

  test('flag off: the shipped scoring modal opens, not the new dialog — the fallback', async ({ page }) => {
    await seedFeatureFlagInitScript(page, 'scoreEntryDialog', false);
    await boot(page);
    const { matchUpId } = await seedTournament(page, 'e2e-score-entry-flag-off');

    await page.evaluate((id) => (dev as any).enterMatchUpScore({ matchUpId: id }), matchUpId);

    await expect(page.locator(OLD_MODAL_SUBMIT)).toBeVisible();
    await expect(page.locator(NEW_DIALOG)).toHaveCount(0);
  });

  test('flag on: the new dialog opens and its result reaches the matchUp', async ({ page }) => {
    await seedFeatureFlagInitScript(page, 'scoreEntryDialog');
    await boot(page);
    const { matchUpId } = await seedTournament(page, 'e2e-score-entry-flag-on');

    // CONTROL: nothing recorded yet, so the assertions below cannot pass on seeded state
    expect((await readRecorded(page, matchUpId)).sets).toEqual([]);

    await page.evaluate((id) => (dev as any).enterMatchUpScore({ matchUpId: id }), matchUpId);

    const dialog = page.locator(NEW_DIALOG);
    await expect(dialog).toBeVisible();
    await expect(page.locator(OLD_MODAL_SUBMIT)).toHaveCount(0);

    // a straight-sets result under Dynamic Sets: the second set's cells appear once the first is complete
    await page.locator(NEW_DIALOG_INPUT(1, 1)).fill('6');
    await page.locator(NEW_DIALOG_INPUT(1, 2)).fill('3');
    await page.locator(NEW_DIALOG_INPUT(2, 1)).waitFor({ state: 'visible' });
    await page.locator(NEW_DIALOG_INPUT(2, 1)).fill('6');
    await page.locator(NEW_DIALOG_INPUT(2, 2)).fill('4');

    const submit = dialog.locator(NEW_DIALOG_SUBMIT);
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect
      .poll(async () => (await readRecorded(page, matchUpId)).matchUpStatus, { timeout: 10_000 })
      .toBe('COMPLETED');
    const recorded = await readRecorded(page, matchUpId);
    expect(recorded.winningSide).toBe(1);
    expect(recorded.sets).toEqual([
      { side1Score: 6, side2Score: 3 },
      { side1Score: 6, side2Score: 4 },
    ]);
    await expect(dialog).toHaveCount(0);
  });
});
