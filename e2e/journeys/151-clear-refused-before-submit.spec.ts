import { initDevBridge, resetState, seedFeatureFlagInitScript, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';
import { enterScore } from '../helpers/enterScore';

/**
 * Journey 151 — a clear the engine would refuse is stopped, with the reason, before it is sent.
 *
 * `[Clear]` then `[Submit]` sends an empty outcome through `setMatchUpStatus`. Where a later match
 * depends on the result the engine refuses it, and the director used to learn that from a toast reading
 * "No valid actions". The factory publishes the answer in advance as the `CLEAR_SCORE` matchUp action
 * (#4795(factory)); TMX reads it at submit time and says why instead (Mentat TASKS.md, "the score modal
 * offers [Submit] for a clear the engine will refuse").
 *
 * Both front ends: the score entry dialog (the default) and the score modal it replaced, which is still
 * one Settings checkbox away.
 */

const REFUSED = "This result can't be cleared: a later match depends on it.";
const ENGINE_REFUSAL = 'No valid actions';
const TOAST = '.notification';

const DIALOGS = [
  {
    name: 'score entry dialog',
    flag: true,
    clear: 'button[data-action="clear"]',
    submit: 'button[data-action="submit"]',
    cancel: 'button[data-action="cancel"]',
  },
  {
    name: 'score modal',
    flag: false,
    clear: '#clearScoreV2',
    submit: '#submitScoreV2',
    cancel: '.chc-modal-dialog button:has-text("Cancel")',
  },
];

type Seeded = { drawId: string; r1m1: string; r1m2: string; r2m1: string };

async function seed(page: Page, tournamentId: string): Promise<Seeded> {
  return page.evaluate(async (tournamentId) => {
    await dev.tmx2db.initDB();
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      drawProfiles: [{ eventName: 'Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
      tournamentAttributes: { tournamentId },
      tournamentName: 'E2E Clear Refused',
      setState: true,
      nonRandom: 1,
    });
    await dev.load({ tournamentRecord });
    const matchUps: any[] = dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || [];
    const find = (roundNumber: number, roundPosition: number) =>
      matchUps.find((m) => m.roundNumber === roundNumber && m.roundPosition === roundPosition);
    return {
      drawId: find(1, 1).drawId,
      r1m1: find(1, 1).matchUpId,
      r1m2: find(1, 2).matchUpId,
      r2m1: find(2, 1).matchUpId,
    };
  }, tournamentId);
}

const winningSide = (page: Page, matchUpId: string): Promise<number | undefined> =>
  page.evaluate(
    (id) =>
      (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).find((m: any) => m.matchUpId === id)
        ?.winningSide,
    matchUpId,
  );

for (const dialog of DIALOGS) {
  test.describe(`journey 151 — a refused clear is stopped before it is sent (${dialog.name})`, () => {
    test('clearing a result a later match depends on says why; clearing the last one goes through', async ({
      page,
    }) => {
      await seedFeatureFlagInitScript(page, 'scoreEntryDialog', dialog.flag);
      await page.goto('/');
      await waitForAppReady(page);
      await initDevBridge(page);
      await resetState(page);
      const { drawId, r1m1, r1m2, r2m1 } = await seed(page, `e2e-clear-refused-${dialog.flag ? 'dialog' : 'modal'}`);

      // the two round-1 matches, then the round-2 match they feed
      await enterScore(page, { drawId, matchUpId: r1m1, scoreString: '6-1 6-1', winningSide: 1 });
      await enterScore(page, { drawId, matchUpId: r1m2, scoreString: '6-2 6-2', winningSide: 1 });
      await enterScore(page, { drawId, matchUpId: r2m1, scoreString: '6-3 6-3', winningSide: 1 });
      await expect.poll(() => winningSide(page, r2m1), { timeout: 10_000 }).toBe(1);

      // 1. round 1: its winner has already played round 2, so the clear is stopped, with the reason
      await page.evaluate((id) => (dev as any).enterMatchUpScore({ matchUpId: id }), r1m1);
      await page.locator(dialog.clear).click();
      await page.locator(dialog.submit).click();
      await expect(page.locator(TOAST).filter({ hasText: REFUSED })).toBeVisible();
      // the engine's own refusal never fires, because the clear was never sent
      await expect(page.locator(TOAST).filter({ hasText: ENGINE_REFUSAL })).toHaveCount(0);
      expect(await winningSide(page, r1m1)).toBe(1);
      // the score entry dialog closes after every submit; the score modal only on success
      if (await page.locator(dialog.cancel).isVisible()) await page.locator(dialog.cancel).click();
      await expect(page.locator(dialog.clear)).toHaveCount(0);

      // 2. round 2: nothing after it is decided, so the same gesture clears it
      await page.evaluate((id) => (dev as any).enterMatchUpScore({ matchUpId: id }), r2m1);
      await page.locator(dialog.clear).click();
      await page.locator(dialog.submit).click();
      await expect.poll(() => winningSide(page, r2m1), { timeout: 10_000 }).toBeUndefined();
    });
  });
}
