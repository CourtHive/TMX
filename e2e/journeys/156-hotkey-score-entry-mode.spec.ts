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
});
