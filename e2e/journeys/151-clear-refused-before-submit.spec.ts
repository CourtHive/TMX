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
 * Two layers, both pinned here, in both front ends (the score entry dialog, the default, and the score
 * modal it replaced, one Settings checkbox away):
 *  - at OPEN, the dialog is told the clear would be refused (`clearable`), and withholds `[Clear]`;
 *  - at SUBMIT, TMX asks again, so a later match decided while the dialog was open still stops the clear.
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
    // the dialog disables it and says why
    withheld: async (page: Page) => {
      await expect(page.locator('button[data-action="clear"]')).toBeDisabled();
      await expect(page.locator('button[data-action="clear"]')).toHaveAttribute('title', REFUSED);
    },
  },
  {
    name: 'score modal',
    flag: false,
    clear: '#clearScoreV2',
    submit: '#submitScoreV2',
    cancel: '.chc-modal-dialog button:has-text("Cancel")',
    // the modal does not offer it
    withheld: async (page: Page) => {
      await expect(page.locator('#submitScoreV2')).toBeVisible();
      await expect(page.locator('#clearScoreV2')).toHaveCount(0);
    },
  },
];

type Seeded = { drawId: string; ids: Record<string, string> };

/** An 8-draw; `ids` keys are `r<round>m<position>`. */
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
    const ids: Record<string, string> = {};
    for (const m of matchUps) ids[`r${m.roundNumber}m${m.roundPosition}`] = m.matchUpId;
    return { drawId: matchUps[0].drawId, ids };
  }, tournamentId);
}

const winningSide = (page: Page, matchUpId: string): Promise<number | undefined> =>
  page.evaluate(
    (id) =>
      (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).find((m: any) => m.matchUpId === id)
        ?.winningSide,
    matchUpId,
  );

const openDialog = (page: Page, matchUpId: string) =>
  page.evaluate((id) => (dev as any).enterMatchUpScore({ matchUpId: id }), matchUpId);

for (const dialog of DIALOGS) {
  test.describe(`journey 151 — a refused clear is never sent (${dialog.name})`, () => {
    test.beforeEach(async ({ page }) => {
      await seedFeatureFlagInitScript(page, 'scoreEntryDialog', dialog.flag);
      await page.goto('/');
      await waitForAppReady(page);
      await initDevBridge(page);
      await resetState(page);
    });

    test('a result a later match depends on opens with [Clear] withheld; the last one clears', async ({ page }) => {
      const { drawId, ids } = await seed(page, `e2e-clear-withheld-${dialog.flag ? 'dialog' : 'modal'}`);
      // the two round-1 matches, then the round-2 match they feed
      await enterScore(page, { drawId, matchUpId: ids.r1m1, scoreString: '6-1 6-1', winningSide: 1 });
      await enterScore(page, { drawId, matchUpId: ids.r1m2, scoreString: '6-2 6-2', winningSide: 1 });
      await enterScore(page, { drawId, matchUpId: ids.r2m1, scoreString: '6-3 6-3', winningSide: 1 });
      await expect.poll(() => winningSide(page, ids.r2m1), { timeout: 10_000 }).toBe(1);

      // 1. round 1: its winner has already played round 2
      await openDialog(page, ids.r1m1);
      await dialog.withheld(page);
      await page.locator(dialog.cancel).click();
      await expect(page.locator(dialog.submit)).toHaveCount(0);

      // 2. round 2: nothing after it is decided, so it clears
      await openDialog(page, ids.r2m1);
      await page.locator(dialog.clear).click();
      await page.locator(dialog.submit).click();
      await expect.poll(() => winningSide(page, ids.r2m1), { timeout: 10_000 }).toBeUndefined();
    });

    test('a later match decided while the dialog is open still stops the clear, and says why', async ({ page }) => {
      const { drawId, ids } = await seed(page, `e2e-clear-raced-${dialog.flag ? 'dialog' : 'modal'}`);
      // both semifinals decided; the final is not, so a semifinal can be cleared — for now
      for (const id of ['r1m1', 'r1m2', 'r1m3', 'r1m4']) {
        await enterScore(page, { drawId, matchUpId: ids[id], scoreString: '6-1 6-1', winningSide: 1 });
      }
      await enterScore(page, { drawId, matchUpId: ids.r2m1, scoreString: '6-2 6-2', winningSide: 1 });
      await enterScore(page, { drawId, matchUpId: ids.r2m2, scoreString: '6-2 6-2', winningSide: 1 });

      await openDialog(page, ids.r2m1);
      await page.locator(dialog.clear).click();

      // ...then the final is decided, as by a colleague, while the dialog is still open
      await enterScore(page, { drawId, matchUpId: ids.r3m1, scoreString: '6-4 6-4', winningSide: 1 });
      await expect.poll(() => winningSide(page, ids.r3m1), { timeout: 10_000 }).toBe(1);

      await page.locator(dialog.submit).click();
      await expect(page.locator(TOAST).filter({ hasText: REFUSED })).toBeVisible();
      // the engine's own refusal never fires, because the clear was never sent
      await expect(page.locator(TOAST).filter({ hasText: ENGINE_REFUSAL })).toHaveCount(0);
      expect(await winningSide(page, ids.r2m1)).toBe(1);
    });
  });
}
