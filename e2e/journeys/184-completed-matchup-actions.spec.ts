import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/**
 * Journey 184 — the matchUp actions menu of a COMPLETED matchUp.
 *
 * Two defects CA reported on 2026-10-30:
 *
 * 1. The menu offered a finished match the actions of one still to be played — Check in, Nominate scorekeeper,
 *    Print match card, Clear schedule — because its terminal-status list omits COMPLETED.
 * 2. Its schedule edits did nothing. `setMatchUpSchedule` sent `bulkScheduleMatchUps` without
 *    `scheduleCompletedMatchUps`, so the engine SKIPPED the matchUp and still answered success: the row showed the
 *    new value, nothing was stored, and it vanished on refresh. A completed match's times must stay editable after
 *    the fact (CA).
 *
 * `matchUpMenuGates.test.ts` and `setMatchUpSchedule.test.ts` cover the rules. Only this layer shows the menu a
 * director actually sees and that the edit reaches the engine.
 */

const START_TIME = '14:00';
const MENU = '.tippy-content .menu-list';

async function browserToday(page: Page): Promise<string> {
  return page.evaluate(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  });
}

/** One matchUp scheduled today with an afternoon START_TIME, then completed 6-1 6-1. */
async function seedCompletedMatchUp(page: Page, today: string) {
  return page.evaluate(
    async ([today, startTime]) => {
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        tournamentAttributes: { tournamentId: 'e2e-completed-actions' },
        drawProfiles: [{ drawSize: 8, eventName: 'Singles' }],
        tournamentName: 'E2E Completed MatchUp Actions',
        startDate: today,
        endDate: today,
        nonRandom: 1,
        setState: true,
      });

      const engine = dev.factory.tournamentEngine;
      engine.setState(tournamentRecord);
      const { matchUps } = engine.allTournamentMatchUps();
      const matchUp = matchUps.find((m: any) => m.sides?.every((s: any) => s?.participantId));

      const { outcome } = dev.factory.mocksEngine.generateOutcomeFromScoreString({
        scoreString: '6-1 6-1',
        winningSide: 1,
      });
      const result = engine.executionQueue(
        [
          {
            method: 'bulkScheduleMatchUps',
            params: { matchUpIds: [matchUp.matchUpId], schedule: { scheduledDate: today, startTime } },
          },
          {
            method: 'setMatchUpStatus',
            params: { drawId: matchUp.drawId, matchUpId: matchUp.matchUpId, outcome },
          },
        ],
        true,
      );
      if (!result.success) throw new Error(`seed failed: ${JSON.stringify(result.error)}`);

      const updated = engine.getTournament().tournamentRecord;
      await dev.load(updated);

      return {
        tournamentId: updated.tournamentId as string,
        matchUpId: matchUp.matchUpId as string,
        sideName: matchUp.sides[0].participant.participantName as string,
      };
    },
    [today, START_TIME] as const,
  );
}

async function openMenu(page: Page, tournamentId: string, sideName: string) {
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToMatchUps();

  const row = page.locator(`${S.TOURNAMENT_MATCHUPS} .tabulator-row`).filter({ hasText: sideName }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });

  const menu = page.locator(MENU);
  for (let attempt = 0; attempt < 4; attempt++) {
    await row.locator('.fa-ellipsis-vertical').click();
    if (await menu.isVisible().catch(() => false)) break;
  }
  await expect(menu).toBeVisible();
  return menu;
}

/** Set the minutes on the open picker (see journey 110 for why the tip is clicked with `force` and retried). */
async function dialMinutes(page: Page, minutes: string) {
  const field = page.locator('input.tp-ui-minutes');
  await field.click();

  const tip = page
    .locator('.tp-ui-tips-wrapper span.tp-ui-minutes-time', { hasText: new RegExp(`^${minutes}$`) })
    .first();

  await expect(tip).toBeVisible();
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.waitForTimeout(400);
    await tip.click({ force: true });
    if ((await field.inputValue()) === minutes) return;
  }
  await expect(field).toHaveValue(minutes);
}

test.describe('Journey 184 — completed matchUp actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('offers its date, times and official, and none of the pre-play actions', async ({ page }) => {
    const today = await browserToday(page);
    const { tournamentId, sideName } = await seedCompletedMatchUp(page, today);

    const menu = await openMenu(page, tournamentId, sideName);

    for (const offered of ['Schedule date', 'Schedule time', 'Start time', 'End time', 'Select official']) {
      await expect(menu.locator('li', { hasText: offered })).toHaveCount(1);
    }
    for (const withheld of ['Check in', 'Nominate scorekeeper', 'Print match card', 'Clear schedule']) {
      await expect(menu.locator('li', { hasText: withheld })).toHaveCount(0);
    }
  });

  test('an end time set after the match is complete is recorded', async ({ page }) => {
    const today = await browserToday(page);
    const { tournamentId, matchUpId, sideName } = await seedCompletedMatchUp(page, today);
    const collector = createMutationCollector(page);

    const menu = await openMenu(page, tournamentId, sideName);
    await menu.locator('li', { hasText: 'End time' }).first().click();
    await expect(page.locator('.tp-ui-modal')).toBeVisible();

    await dialMinutes(page, '30');
    await page.locator('.tp-ui-ok-btn').click();

    await collector.waitForMethod('bulkScheduleMatchUps');
    await expect(page.locator('.notification.is-danger')).toHaveCount(0);

    // The regression: the engine skipped the completed matchUp and the end time was never stored.
    await expect
      .poll(() =>
        page.evaluate((id) => {
          const { matchUps } = dev.factory.tournamentEngine.allTournamentMatchUps();
          return matchUps.find((m: any) => m.matchUpId === id)?.schedule?.endTime;
        }, matchUpId),
      )
      .toBe('14:30');
  });
});
