import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';
import { enterScore } from '../helpers/enterScore';
import { S } from '../helpers/selectors';

/**
 * Journey 139 — a walkover recorded before the second opponent arrives (#1535).
 *
 * A participant wins round 1 and is alone in the round-2 matchUp while the other round-1 match
 * is still to be played. Then they cannot continue (ill, injured, defaulted). The director must be
 * able to record the walkover NOW, from the matchUps table, without a second participant present:
 * the factory offers it as the EXIT matchUp action and TMX routes the score click to the
 * walkover-or-default dialog instead of the scoring modal, which needs two participants.
 *
 * What the journey asserts, in order:
 *  1. after a normal round-1 result the round-2 matchUp has exactly one participant, so the state
 *     under test is real (a control: without it the dialog check below would prove nothing);
 *  2. clicking that matchUp's score cell opens the walkover-or-default dialog, not the scoring
 *     modal, and recording WALKOVER awards the EMPTY side — the present participant does not
 *     advance;
 *  3. when the other round-1 match is decided its winner arrives, takes the walkover, and stands
 *     in the semifinal. That is the exit cascade the factory runs; the UI only has to have
 *     recorded the exit in the shape the cascade reads.
 */
const DRAW_SIZE = 8;
const SCORE_CELL = '.tabulator-cell[tabulator-field="scoreDetail"]';
// assert on the DIALOG, as journeys 106/108 do: the fixed-position .chc-modal-container collapses to zero height
const MODAL_DIALOG = '.chc-modal-dialog';
const DIALOG_TITLE = 'Walkover or default';
const EXIT_BUTTON = 'Exit';
const WALKOVER = 'WALKOVER';

type Seeded = {
  tournamentId: string;
  drawId: string;
  r1m1: string;
  r1m2: string;
  r2m1: string;
  r3m1: string;
};

type MatchUpView = {
  matchUpStatus?: string;
  winningSide?: number;
  sides: { sideNumber: number; participantId?: string; participantName?: string }[];
};

async function seed(page: Page): Promise<Seeded> {
  return page.evaluate(async (drawSize) => {
    await dev.tmx2db.initDB();
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      drawProfiles: [{ eventName: 'Singles', drawSize, drawType: 'SINGLE_ELIMINATION' }],
      tournamentAttributes: { tournamentId: 'e2e-exit-before-arrival' },
      tournamentName: 'E2E Exit Before Arrival',
      setState: true,
      nonRandom: 1,
    });
    await dev.load({ tournamentRecord });
    const matchUps: any[] = dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || [];
    const find = (roundNumber: number, roundPosition: number) =>
      matchUps.find((m) => m.roundNumber === roundNumber && m.roundPosition === roundPosition);
    const r1m1 = find(1, 1);
    const r1m2 = find(1, 2);
    const r2m1 = find(2, 1);
    const r3m1 = find(3, 1);
    if (!r1m1 || !r1m2 || !r2m1 || !r3m1) throw new Error('seed: the 8-draw did not produce the expected matchUps');
    return {
      tournamentId: tournamentRecord.tournamentId,
      drawId: r1m1.drawId,
      r1m1: r1m1.matchUpId,
      r1m2: r1m2.matchUpId,
      r2m1: r2m1.matchUpId,
      r3m1: r3m1.matchUpId,
    };
  }, DRAW_SIZE);
}

async function readMatchUp(page: Page, matchUpId: string): Promise<MatchUpView> {
  return page.evaluate((id) => {
    const m: any = (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).find(
      (x: any) => x.matchUpId === id,
    );
    return {
      matchUpStatus: m?.matchUpStatus,
      winningSide: m?.winningSide,
      sides: (m?.sides ?? []).map((s: any) => ({
        sideNumber: s.sideNumber,
        participantId: s.participantId,
        participantName: s.participant?.participantName,
      })),
    };
  }, matchUpId);
}

const present = (m: MatchUpView) => m.sides.filter((s) => s.participantId);

test.describe('journey 139 — exit before the opponent arrives', () => {
  test('a walkover recorded with one participant present awards the empty side, and the arriving winner takes it', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    const { tournamentId, drawId, r1m1, r1m2, r2m1, r3m1 } = await seed(page);

    // 1. a normal round-1 result puts exactly one participant into round 2
    await enterScore(page, { drawId, matchUpId: r1m1, scoreString: '6-1 6-1', winningSide: 1 });
    await expect.poll(async () => present(await readMatchUp(page, r2m1)).length, { timeout: 10_000 }).toBe(1);
    const before = await readMatchUp(page, r2m1);
    const [alone] = present(before);
    expect(alone.participantName).toBeTruthy();
    const emptySide = alone.sideNumber === 1 ? 2 : 1;

    // 2. the score click on that matchUp opens the walkover-or-default dialog, not the scoring modal
    const tournamentPage = new TournamentPage(page);
    await tournamentPage.goto(tournamentId);
    await tournamentPage.navigateToMatchUps();
    await page.locator(S.TOURNAMENT_MATCHUPS).waitFor({ state: 'visible', timeout: 10_000 });
    const rows = page.locator(`${S.TOURNAMENT_MATCHUPS} .tabulator-row`).filter({ hasText: alone.participantName! });
    // the round-1 row carries the score; the round-2 row is the one with no score yet
    const roundTwoRow = rows.filter({ hasNot: page.locator(SCORE_CELL, { hasText: '6-1' }) }).first();
    await roundTwoRow.waitFor({ state: 'visible', timeout: 10_000 });
    await roundTwoRow.locator(SCORE_CELL).click();

    const modal = page.locator(MODAL_DIALOG).filter({ hasText: DIALOG_TITLE });
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(alone.participantName!);
    const exitSelect = modal.locator('select');
    const offered = await exitSelect.locator('option').evaluateAll((o) => o.map((x: any) => x.value));
    expect(offered).toContain(WALKOVER);
    await exitSelect.selectOption(WALKOVER);
    await modal.getByRole('button', { name: EXIT_BUTTON }).click();

    await expect.poll(async () => (await readMatchUp(page, r2m1)).matchUpStatus, { timeout: 10_000 }).toBe(WALKOVER);
    const recorded = await readMatchUp(page, r2m1);
    expect(recorded.winningSide).toBe(emptySide);
    const semifinalBefore = await readMatchUp(page, r3m1);
    expect(present(semifinalBefore).map((s) => s.participantId)).not.toContain(alone.participantId);

    // 3. the other round-1 winner arrives, takes the walkover, and stands in the semifinal
    await enterScore(page, { drawId, matchUpId: r1m2, scoreString: '6-2 6-2', winningSide: 1 });
    await expect.poll(async () => (await readMatchUp(page, r1m2)).winningSide, { timeout: 10_000 }).toBe(1);
    const arriving = (await readMatchUp(page, r1m2)).sides.find((s) => s.sideNumber === 1)!;
    expect(arriving.participantId).toBeTruthy();
    await expect
      .poll(async () => present(await readMatchUp(page, r3m1)).map((s) => s.participantId), { timeout: 10_000 })
      .toContain(arriving.participantId);
    const after = await readMatchUp(page, r2m1);
    expect(after.matchUpStatus).toBe(WALKOVER);
    expect(
      present(after)
        .map((s) => s.participantId)
        .sort((a, b) => a!.localeCompare(b!)),
    ).toEqual([alone.participantId, arriving.participantId].sort((a, b) => a!.localeCompare(b!)));
    expect(after.sides.find((s) => s.sideNumber === after.winningSide)?.participantId).toBe(arriving.participantId);
  });
});
