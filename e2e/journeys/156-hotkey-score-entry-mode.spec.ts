import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';
import { seedTournament } from '../helpers/seed';
import { S } from '../helpers/selectors';

/**
 * Journey 156 — hotkey score entry from the matchUps page.
 *
 * CA, 2026-10-12: restore the old flow, toggled by the inline-scoring icon just left of [Actions]. With it on,
 * every matchUp ready to score is an entry field; Tab / Shift+Tab move between them; typing uses the keypad (a
 * digit is the losing side's games); Enter saves and moves to the next field. A points total (SET1-S:P32) gets
 * no field — the keypad cannot enter it — and a completed 16–16 tie still shows its score.
 */

const TOGGLE = '#hotkeyScoringToggle';
const FIELD = '.hotkeyScoreField';

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);
  await page.evaluate(() => {
    (dev as any).env.hotkeys = false;
  });
}

const focusedMatchUpId = (page: Page) =>
  page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset?.matchUpId);

const fieldIds = (page: Page): Promise<string[]> =>
  page.locator(FIELD).evaluateAll((fields) => fields.map((field) => (field as HTMLElement).dataset.matchUpId ?? ''));

const recorded = (page: Page, matchUpId: string) =>
  page.evaluate((id) => {
    const m: any = (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).find(
      (x: any) => x.matchUpId === id,
    );
    return { status: m?.matchUpStatus, score: m?.score?.scoreStringSide1 };
  }, matchUpId);

const TOAST = '.notification';
// the score entry dialog's own words for the empty card it will not submit (courthive-components default)
const REPLACEMENT_REQUIRED = 'Enter a replacement score: a later match depends on this result.';
const DIALOG_CANCEL = 'button[data-action="cancel"]';
const DIALOG_SUBMIT = 'button[data-action="submit"]';
const DIALOG_CLEAR = 'button[data-action="clear"]';
const ENGINE_REFUSAL = 'No valid actions';
// TMX's own reason for a clear it stops (toasts.clearRefused)
const CLEAR_REFUSED = "This result can't be cleared: a later match depends on it.";

type Scoring = { round: number; position: number; status: string; sets: number[][]; winningSide?: number };

/** Score matchUps in the engine and persist the record, before the page renders; returns ids keyed r<round>p<position>. */
async function scoreBeforeRender(page: Page, scorings: Scoring[]): Promise<Record<string, string>> {
  return page.evaluate(async (list) => {
    const engine: any = dev.factory.tournamentEngine;
    const ids: Record<string, string> = {};
    for (const { round, position, status, sets, winningSide } of list) {
      const target = engine
        .allTournamentMatchUps({ inContext: true })
        .matchUps.find((m: any) => m.roundNumber === round && m.roundPosition === position);
      const result = engine.setMatchUpStatus({
        matchUpId: target.matchUpId,
        drawId: target.drawId,
        outcome: {
          matchUpStatus: status,
          winningSide,
          score: {
            sets: sets.map(([side1Score, side2Score, setWinner], index) => ({
              setNumber: index + 1,
              side1Score,
              side2Score,
              winningSide: setWinner,
            })),
          },
        },
      });
      if (!result.success) throw new Error(`seed: r${round}p${position} was not scored`);
      ids[`r${round}p${position}`] = target.matchUpId;
    }
    await dev.tmx2db.addTournament(engine.getTournament().tournamentRecord);
    return ids;
  }, scorings);
}

async function openMatchUps(page: Page, tournamentId: string): Promise<void> {
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToMatchUps();
  await expect(page.locator(S.TOURNAMENT_MATCHUPS)).toBeVisible();
}

const scoreCellWithText = (page: Page, score: string) =>
  page.locator(`${S.TOURNAMENT_MATCHUPS} .tabulator-cell[tabulator-field="scoreDetail"]`, { hasText: score });

test.describe('journey 156 — hotkey score entry mode', () => {
  test.beforeEach(async ({ page }) => {
    await boot(page);
  });

  test('the icon turns ready matchUps into entry fields; Enter saves and moves on; Tab moves between', async ({
    page,
  }) => {
    const tournamentId = await seedTournament(page, {
      tournamentName: 'E2E Hotkey Entry',
      tournamentAttributes: { tournamentId: 'e2e-hotkey-entry' },
      participantsProfile: { scaledParticipantsCount: 16 },
      drawProfiles: [
        { eventName: 'Tennis', drawType: 'SINGLE_ELIMINATION', drawSize: 8 },
        { eventName: 'Americano', drawType: 'ROUND_ROBIN', drawSize: 4, matchUpFormat: 'SET1-S:P32' },
      ],
    });

    // a completed points-total tie, recorded before the page renders
    const tieId = await page.evaluate(async () => {
      const engine: any = dev.factory.tournamentEngine;
      const target = engine
        .allTournamentMatchUps({ inContext: true })
        .matchUps.find((m: any) => m.matchUpFormat === 'SET1-S:P32' && m.readyToScore);
      const result = engine.setMatchUpStatus({
        matchUpId: target.matchUpId,
        drawId: target.drawId,
        outcome: { matchUpStatus: 'COMPLETED', score: { sets: [{ setNumber: 1, side1Score: 16, side2Score: 16 }] } },
      });
      if (!result.success) throw new Error('seed: the tie was not recorded');
      await dev.tmx2db.addTournament(engine.getTournament().tournamentRecord);
      return target.matchUpId as string;
    });

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToMatchUps();
    await expect(page.locator(S.TOURNAMENT_MATCHUPS)).toBeVisible();

    // the completed tie shows its score
    await expect(page.locator(`${S.TOURNAMENT_MATCHUPS} .tabulator-row`, { hasText: '16-16' })).toHaveCount(1);
    expect((await recorded(page, tieId)).status).toBe('COMPLETED');

    // off: no entry fields
    await expect(page.locator(FIELD)).toHaveCount(0);

    // on: one field per ready tennis matchUp, none for the points totals, and the first is focused
    await page.locator(TOGGLE).click();
    await expect(page.locator(FIELD)).toHaveCount(4);
    expect(await page.evaluate(() => (dev as any).env.hotkeys)).toBe(true);
    const ids = await fieldIds(page);
    await expect.poll(() => focusedMatchUpId(page)).toBe(ids[0]);
    for (const id of ids) {
      const format = await page.evaluate(
        (matchUpId) =>
          (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).find(
            (m: any) => m.matchUpId === matchUpId,
          )?.matchUpFormat,
        id,
      );
      expect(format).not.toBe('SET1-S:P32');
    }

    // type a set: the field shows it; Enter saves it and moves to the next field
    await page.keyboard.press('3');
    await expect(page.locator(`${FIELD}[data-match-up-id="${ids[0]}"]`)).toHaveText('6-3');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await recorded(page, ids[0])).score).toBe('6-3');
    await expect.poll(() => focusedMatchUpId(page)).toBe(ids[1]);

    // Tab and Shift+Tab move between the fields
    await page.keyboard.press('Tab');
    await expect.poll(() => focusedMatchUpId(page)).toBe(ids[2]);
    await page.keyboard.press('Shift+Tab');
    await expect.poll(() => focusedMatchUpId(page)).toBe(ids[1]);

    // Enter with nothing typed saves nothing and moves on
    await page.keyboard.press('Enter');
    await expect.poll(() => focusedMatchUpId(page)).toBe(ids[2]);
    expect((await recorded(page, ids[1])).score).toBeUndefined();

    // off again: the fields go
    await page.locator(TOGGLE).click();
    await expect(page.locator(FIELD)).toHaveCount(0);
    expect(await page.evaluate(() => (dev as any).env.hotkeys)).toBe(false);
  });

  test('Backspace to empty, then Enter, clears an in-progress score', async ({ page }) => {
    const tournamentId = await seedTournament(page, {
      tournamentName: 'E2E Hotkey Clear',
      tournamentAttributes: { tournamentId: 'e2e-hotkey-clear' },
      participantsProfile: { scaledParticipantsCount: 8 },
      drawProfiles: [{ eventName: 'Tennis', drawType: 'SINGLE_ELIMINATION', drawSize: 4 }],
    });
    const inProgressId = await scoreBeforeRender(page, [
      { round: 1, position: 1, status: 'IN_PROGRESS', sets: [[6, 3, 1]] },
    ]);

    await openMatchUps(page, tournamentId);
    await page.locator(TOGGLE).click();
    const field = page.locator(`${FIELD}[data-match-up-id="${inProgressId.r1p1}"]`);
    await expect(field).toHaveText('6-3');
    await field.focus();

    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await expect(field).toHaveText('Enter score');
    await page.keyboard.press('Enter');

    await expect.poll(async () => (await recorded(page, inProgressId.r1p1)).status).toBe('TO_BE_PLAYED');
    expect((await recorded(page, inProgressId.r1p1)).score ?? '').toBe('');
  });

  test('a final result opens the score dialog, where a clear a later match depends on cannot be submitted', async ({
    page,
  }) => {
    const tournamentId = await seedTournament(page, {
      tournamentName: 'E2E Hotkey Clear Refused',
      tournamentAttributes: { tournamentId: 'e2e-hotkey-clear-refused' },
      participantsProfile: { scaledParticipantsCount: 8 },
      drawProfiles: [{ eventName: 'Tennis', drawType: 'SINGLE_ELIMINATION', drawSize: 4 }],
    });
    const ids = await scoreBeforeRender(page, [
      {
        round: 1,
        position: 1,
        status: 'COMPLETED',
        sets: [
          [6, 1, 1],
          [6, 1, 1],
        ],
        winningSide: 1,
      },
      {
        round: 1,
        position: 2,
        status: 'COMPLETED',
        sets: [
          [6, 3, 1],
          [6, 3, 1],
        ],
        winningSide: 1,
      },
      {
        round: 2,
        position: 1,
        status: 'COMPLETED',
        sets: [
          [6, 2, 1],
          [6, 2, 1],
        ],
        winningSide: 1,
      },
    ]);

    await openMatchUps(page, tournamentId);
    await page.locator(TOGGLE).click();

    // A final result is corrected in the score dialog even in hotkey mode (#1697): the keypad is for
    // unfinished scores. A semifinal whose winner has played the final: [Clear] resets the form, but the
    // empty card cannot be submitted, so the clear is never sent.
    await scoreCellWithText(page, '6-1 6-1').click();
    await expect(page.locator(DIALOG_CLEAR)).toBeEnabled();
    await page.locator(DIALOG_CLEAR).click();
    await expect(page.locator(DIALOG_SUBMIT)).toBeDisabled();
    await expect(page.locator(DIALOG_SUBMIT)).toHaveAttribute('title', REPLACEMENT_REQUIRED);
    await page.locator(DIALOG_CANCEL).click();
    await expect(page.locator(DIALOG_SUBMIT)).toHaveCount(0);
    await expect(page.locator(TOAST).filter({ hasText: ENGINE_REFUSAL })).toHaveCount(0);
    expect(await recorded(page, ids.r1p1)).toEqual({ status: 'COMPLETED', score: '6-1 6-1' });

    // the final: nothing depends on it, so it clears
    await scoreCellWithText(page, '6-2 6-2').click();
    await page.locator(DIALOG_CLEAR).click();
    await page.locator(DIALOG_SUBMIT).click();
    await expect.poll(async () => (await recorded(page, ids.r2p1)).status).toBe('TO_BE_PLAYED');
  });

  test('a double walkover a later match depends on stays on the keypad, and its clear is stopped with the reason', async ({
    page,
  }) => {
    const tournamentId = await seedTournament(page, {
      tournamentName: 'E2E Hotkey Double Exit',
      tournamentAttributes: { tournamentId: 'e2e-hotkey-double-exit' },
      participantsProfile: { scaledParticipantsCount: 8 },
      drawProfiles: [{ eventName: 'Tennis', drawType: 'SINGLE_ELIMINATION', drawSize: 8 }],
    });
    const won = {
      status: 'COMPLETED',
      sets: [
        [6, 1, 1],
        [6, 1, 1],
      ],
      winningSide: 1,
    };
    // R1 #1 is a double walkover: no winner, so it is not a final result and keeps its entry field, yet it produces
    // the walkover in R2 #1, whose opponent then plays the final. Clearing it would rewrite a decided path.
    const ids = await scoreBeforeRender(page, [
      { round: 1, position: 1, status: 'DOUBLE_WALKOVER', sets: [] },
      { round: 1, position: 2, ...won },
      { round: 1, position: 3, ...won },
      { round: 1, position: 4, ...won },
      { round: 2, position: 2, ...won },
      { round: 3, position: 1, ...won },
    ]);

    await openMatchUps(page, tournamentId);
    await page.locator(TOGGLE).click();
    const field = page.locator(`${FIELD}[data-match-up-id="${ids.r1p1}"]`);
    await expect(field).toHaveCount(1);
    await field.focus();
    for (let i = 0; i < 6; i++) await page.keyboard.press('Backspace');
    await page.keyboard.press('Enter');

    await expect(page.locator(TOAST).filter({ hasText: CLEAR_REFUSED })).toBeVisible();
    await expect(page.locator(TOAST).filter({ hasText: ENGINE_REFUSAL })).toHaveCount(0);
    expect((await recorded(page, ids.r1p1)).status).toBe('DOUBLE_WALKOVER');
  });
});
