import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { daysFromTodayLocal } from '../helpers/dates';

/**
 * Journey 220 — the score entry dialog closes only on an accepted result (ecosystem review 713, PR #2062).
 *
 * The dialog's submission is controlled (courthive-components >= 7.20): it stays open while the save is pending and
 * on any refusal, and closes only once the save is accepted, so what the director sees close is what was saved.
 * Unit tests cover `dispatch` against a mocked mutationRequest; this drives the real dialog against the real engine:
 *
 *   1. an accepted score closes the dialog and is in the record
 *   2. a clear that a later match depends on cannot be submitted: the card says why, and the record is unchanged
 *   3. another director scores the same match while the dialog is open: submitting asks before overwriting; letting
 *      the question lapse keeps the dialog open and the colleague's score; confirming saves ours and closes
 *
 * The dialog is opened through TMX's own enterMatchUpScore on chosen matchUps, so the journey does not depend on
 * where a draw renders its score links.
 */

const CARD = '[data-component="scoreEntryCard"]';
const DRAW_ID = 'e2e-score-dialog-draw';
// the confirm, not the passive "Another user just scored this match" notice that arrives with the remote score
const OVERWRITE_PROMPT = 'Overwrite with your result';
// TMX's toasts (services/notifications/toaster.ts)
const TOAST = '.notification';
const REMOTE_SCORE = '7-5 7-5';

async function seed(page: Page) {
  const dates = { startDate: daysFromTodayLocal(-1), endDate: daysFromTodayLocal(3) };
  return page.evaluate(
    async ({ startDate, endDate, drawId }) => {
      const { mocksEngine, tournamentEngine } = dev.factory;
      const { tournamentRecord } = mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        tournamentName: 'E2E Score Dialog',
        tournamentAttributes: { tournamentId: 'e2e-score-dialog', startDate, endDate },
        // 16 draw, first round and two second-round matches complete
        drawProfiles: [{ drawId, drawSize: 16, completionGoal: 10, matchUpFormat: 'SET3-S:6/TB7' }],
      });
      await dev.load(tournamentRecord);
      const { matchUps } = tournamentEngine.allTournamentMatchUps({ inContext: true });
      const pick = (round: number, position: number) =>
        matchUps.find((m: any) => m.roundNumber === round && m.roundPosition === position)?.matchUpId;
      return {
        tournamentId: tournamentRecord.tournamentId,
        // R1 #1 fed R2 #1, which is complete: its result cannot be cleared
        refusedClear: pick(1, 1),
        // R2 #3 and #4: both sides known, not yet scored
        accepted: pick(2, 3),
        contested: pick(2, 4),
      };
    },
    { ...dates, drawId: DRAW_ID },
  );
}

/** Open the real score entry dialog for a matchUp, as the draw and the matchUps table do. */
async function openDialog(page: Page, matchUpId: string) {
  await page.evaluate(
    async ({ matchUpId, module }) => {
      const { enterMatchUpScore } = await import(module);
      enterMatchUpScore({ matchUpId });
    },
    { matchUpId, module: '/src/services/transitions/scoreMatchUp.ts' },
  );
  await expect(page.locator(CARD)).toBeVisible();
}

async function enterScore(page: Page, sets: [number, number][]) {
  const card = page.locator(CARD);
  for (const [index, [side1, side2]] of sets.entries()) {
    const set = index + 1;
    await card.locator(`input[data-side="1"][data-set="${set}"]`).fill(String(side1));
    await card.locator(`input[data-side="2"][data-set="${set}"]`).fill(String(side2));
  }
}

const submit = (page: Page) => page.locator(`${CARD} button[data-action="submit"]`).click();

const scoreOf = (page: Page, matchUpId: string) =>
  page.evaluate((id) => {
    const matchUp = dev.factory.tournamentEngine.findMatchUp({ matchUpId: id })?.matchUp;
    return { status: matchUp?.matchUpStatus, score: matchUp?.score?.scoreStringSide1 ?? '' };
  }, matchUpId);

test.describe('Journey 220 — the score dialog closes only on an accepted result', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('an accepted score closes the dialog and is in the record', async ({ page }) => {
    const { tournamentId, accepted } = await seed(page);
    await page.goto(`/#/tournament/${tournamentId}/matchUps`);
    await openDialog(page, accepted);
    await enterScore(page, [
      [6, 4],
      [6, 3],
    ]);
    await submit(page);
    await expect(page.locator(CARD)).toBeHidden();
    await expect.poll(() => scoreOf(page, accepted)).toMatchObject({ status: 'COMPLETED', score: '6-4 6-3' });
  });

  test('a clear a later match depends on cannot be submitted, says why, and changes nothing', async ({ page }) => {
    const { tournamentId, refusedClear } = await seed(page);
    await page.goto(`/#/tournament/${tournamentId}/matchUps`);
    const before = await scoreOf(page, refusedClear);
    expect(before.status).toBe('COMPLETED');

    await openDialog(page, refusedClear);
    await page.locator(`${CARD} button[data-action="clear"]`).click();

    // the card knows a later match depends on this result: a clear cannot be submitted, and it says why.
    // (TMX's own clearPermitted refusal behind it is defence in depth, covered by scoreMatchUp.test.ts.)
    const submitButton = page.locator(`${CARD} button[data-action="submit"]`);
    await expect(submitButton).toBeDisabled();
    await expect(submitButton).toHaveAttribute('title', /a later match depends on this result/);
    await expect(page.locator(CARD).getByText('a later match depends on this result', { exact: false })).toBeVisible();
    expect(await scoreOf(page, refusedClear)).toEqual(before);

    // cancelling leaves the result exactly as it was
    await page.locator(`${CARD} button[data-action="cancel"]`).click();
    await expect(page.locator(CARD)).toBeHidden();
    expect(await scoreOf(page, refusedClear)).toEqual(before);
  });

  test("another director's score is never overwritten without asking", async ({ page }) => {
    const { tournamentId, contested } = await seed(page);
    await page.goto(`/#/tournament/${tournamentId}/matchUps`);
    await openDialog(page, contested);

    // while the dialog is open, a colleague's result arrives through the real remote-apply handler
    await page.evaluate(
      ({ tournamentId, drawId, matchUpId }) => {
        const { outcome } = dev.factory.mocksEngine.generateOutcomeFromScoreString({
          scoreString: '7-5 7-5',
          winningSide: 1,
        });
        dev.simulateTournamentMutation({
          tournamentIds: [tournamentId],
          userId: 'another-director',
          methods: [{ method: 'setMatchUpStatus', params: { drawId, matchUpId, outcome } }],
        });
      },
      { tournamentId, drawId: DRAW_ID, matchUpId: contested },
    );
    await expect.poll(() => scoreOf(page, contested)).toMatchObject({ score: REMOTE_SCORE });

    await enterScore(page, [
      [6, 1],
      [6, 1],
    ]);
    await submit(page);
    const overwrite = page.locator(TOAST, { hasText: OVERWRITE_PROMPT });
    await expect(overwrite).toBeVisible();
    // the dialog waits on the question, and nothing has been sent
    await expect(page.locator(CARD)).toBeVisible();
    expect((await scoreOf(page, contested)).score).toBe(REMOTE_SCORE);

    // the question is dismissed unanswered: not saved, the colleague's score stands, the dialog is still open
    await overwrite.locator('.delete').click();
    await expect(overwrite).toBeHidden();
    await expect(page.locator(CARD)).toBeVisible();
    expect((await scoreOf(page, contested)).score).toBe(REMOTE_SCORE);

    // asked again and confirmed: ours is saved and the dialog closes
    await submit(page);
    await page.locator(TOAST, { hasText: OVERWRITE_PROMPT }).getByRole('button', { name: 'Overwrite' }).click();
    await expect(page.locator(CARD)).toBeHidden();
    await expect.poll(() => scoreOf(page, contested)).toMatchObject({ status: 'COMPLETED', score: '6-1 6-1' });
  });
});
