import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';

/**
 * Journey 154 — a points-total tie is entered, and TMX treats it as finished.
 *
 * A combined-point total that allows a tie (`SET1-S:P32`, Americano / Padel scoring) can end 16–16: COMPLETED
 * with no winner. CA, 2026-10-11: "the whole point of supporting P in matchUpFormat was to be able to support
 * Padel scoring where ties are valid". Every score dialog required a winner before [Submit], so the result
 * could not be entered, and the factory then read the finished tie as ready to score (Mentat TASKS.md, "A tied
 * points total … cannot be entered").
 *
 * Driven through the score entry dialog (TMX's default) on a round robin, where the factory accepts a tie:
 *  - 16–16 enables [Submit] and is recorded COMPLETED with no winner, and is no longer ready to score;
 *  - control: 17–15 in the same group is recorded with its winner, as before.
 */

const NEW_DIALOG = '.chc-sec';
const NEW_DIALOG_SUBMIT = '.chc-sec-btn-primary';
const NEW_DIALOG_INPUT = (set: number, side: number) =>
  `input.chc-sec-set-input[data-set="${set}"][data-side="${side}"]`;

type Recorded = {
  matchUpStatus?: string;
  winningSide?: number;
  readyToScore?: boolean;
  sets: { side1Score?: number; side2Score?: number }[];
};

async function seed(page: Page, tournamentId: string): Promise<string[]> {
  return page.evaluate(async (tournamentId) => {
    await dev.tmx2db.initDB();
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      drawProfiles: [{ eventName: 'Americano', drawSize: 4, drawType: 'ROUND_ROBIN', matchUpFormat: 'SET1-S:P32' }],
      tournamentAttributes: { tournamentId },
      tournamentName: 'E2E Points Total Tie',
      setState: true,
      nonRandom: 1,
    });
    await dev.load({ tournamentRecord });
    const matchUps: any[] = dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || [];
    const playable = matchUps.filter((m: any) => m.readyToScore);
    if (playable.length < 2) throw new Error('seed: fewer than two playable matchUps');
    if (playable[0].matchUpFormat !== 'SET1-S:P32') throw new Error(`seed: format is ${playable[0].matchUpFormat}`);
    return playable.map((m: any) => m.matchUpId);
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
      readyToScore: m?.readyToScore,
      sets: (m?.score?.sets ?? []).map((s: any) => ({ side1Score: s.side1Score, side2Score: s.side2Score })),
    };
  }, matchUpId);
}

async function enterInDialog(page: Page, matchUpId: string, side1: string, side2: string): Promise<void> {
  await page.evaluate((id) => (dev as any).enterMatchUpScore({ matchUpId: id }), matchUpId);
  const dialog = page.locator(NEW_DIALOG);
  await expect(dialog).toBeVisible();
  await page.locator(NEW_DIALOG_INPUT(1, 1)).fill(side1);
  await page.locator(NEW_DIALOG_INPUT(1, 2)).fill(side2);
  const submit = dialog.locator(NEW_DIALOG_SUBMIT);
  await expect(submit).toBeEnabled();
  await submit.click();
}

test.describe('journey 154 — a points-total tie', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('16–16 is entered through the dialog, recorded COMPLETED with no winner, and is finished', async ({ page }) => {
    const [tied, won] = await seed(page, 'e2e-points-total-tie');

    await enterInDialog(page, tied, '16', '16');
    await expect
      .poll(async () => (await readRecorded(page, tied)).matchUpStatus, { timeout: 10_000 })
      .toBe('COMPLETED');
    const recorded = await readRecorded(page, tied);
    expect(recorded.winningSide).toBeUndefined();
    expect(recorded.sets).toEqual([{ side1Score: 16, side2Score: 16 }]);
    expect(recorded.readyToScore).toBe(false);

    // control: a won total in the same group keeps its winner
    await enterInDialog(page, won, '17', '15');
    await expect.poll(async () => (await readRecorded(page, won)).winningSide, { timeout: 10_000 }).toBe(1);
  });
});
