import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/**
 * Journey 185 — the matchUp actions menu is the factory's `matchUpActions` (CA, 2026-10-30).
 *
 * The menu used to decide its items in TMX. It now offers an item exactly when the factory offers its action, and its
 * date picker offers only the dates the factory's bounds allow:
 *
 * - a walkover keeps its date, time and official, with no start or end time and no check-in;
 * - a first-round match is not offered a date after the day its second-round match is scheduled.
 *
 * `matchUpMenuGates.test.ts` covers the mapping from actions to items; factory `scheduleMatchUpActions.test.ts` covers
 * which actions are offered, including that a BYE is offered none (the matchUps table lists no BYE row to open here).
 * Only this layer shows the menu a director sees.
 */

const MENU = '.tippy-content .menu-list';
const DAY1 = '2026-11-10';
const DAY2 = '2026-11-11';
const DAY3 = '2026-11-12';

type Seeded = { tournamentId: string; walkoverSide: string; firstRoundSide: string };

/** A 3-day draw of 8 with one BYE: a walkover, a first-round match on day 1, and the match it feeds on day 2. */
async function seed(page: Page): Promise<Seeded> {
  return page.evaluate(
    async ([day1, day2, day3]) => {
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        tournamentAttributes: { tournamentId: 'e2e-menu-from-actions' },
        drawProfiles: [{ drawSize: 8, participantsCount: 7, eventName: 'Singles' }],
        tournamentName: 'E2E Menu From Actions',
        startDate: day1,
        endDate: day3,
        nonRandom: 1,
        setState: true,
      });

      const engine = dev.factory.tournamentEngine;
      engine.setState(tournamentRecord);
      const at = (roundNumber: number, roundPosition: number) =>
        engine
          .allTournamentMatchUps()
          .matchUps.find((m: any) => m.roundNumber === roundNumber && m.roundPosition === roundPosition);
      const named = (matchUp: any, sideNumber?: number) =>
        matchUp.sides.find((s: any) => s?.participant && (!sideNumber || s.sideNumber === sideNumber))?.participant
          .participantName;

      const played = [2, 3, 4].map((position) => at(1, position)).filter((m: any) => m.matchUpStatus !== 'BYE');
      const [walkover, firstRound] = played;
      const feeds = at(2, Math.ceil(firstRound.roundPosition / 2));

      const result = engine.executionQueue(
        [
          {
            method: 'setMatchUpStatus',
            params: {
              drawId: walkover.drawId,
              matchUpId: walkover.matchUpId,
              outcome: { matchUpStatus: 'WALKOVER', winningSide: 1 },
            },
          },
          {
            method: 'addMatchUpScheduleItems',
            params: { drawId: firstRound.drawId, matchUpId: firstRound.matchUpId, schedule: { scheduledDate: day1 } },
          },
          {
            method: 'addMatchUpScheduleItems',
            params: { drawId: feeds.drawId, matchUpId: feeds.matchUpId, schedule: { scheduledDate: day2 } },
          },
        ],
        true,
      );
      if (!result.success) throw new Error(`seed failed: ${JSON.stringify(result.error)}`);

      const updated = engine.getTournament().tournamentRecord;
      await dev.load(updated);
      return {
        tournamentId: updated.tournamentId as string,
        walkoverSide: named(walkover, 2), // the loser: the winner's name is in the next round too
        firstRoundSide: named(firstRound),
      };
    },
    [DAY1, DAY2, DAY3] as const,
  );
}

async function openMenu(page: Page, sideName: string, roundName = 'Quarterfinal') {
  const row = page
    .locator(`${S.TOURNAMENT_MATCHUPS} .tabulator-row`)
    .filter({ hasText: sideName })
    .filter({ hasText: roundName })
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

test.describe('Journey 185 — the matchUp menu follows the factory actions', () => {
  let seeded: Seeded;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    seeded = await seed(page);
    const tournament = new TournamentPage(page);
    await tournament.goto(seeded.tournamentId);
    await tournament.navigateToMatchUps();
  });

  test('a walkover keeps its date, time and official, with no start, end or check-in', async ({ page }) => {
    const menu = await openMenu(page, seeded.walkoverSide);
    for (const offered of ['Schedule date', 'Schedule time', 'Select official']) {
      await expect(menu.locator('li', { hasText: offered })).toHaveCount(1);
    }
    for (const withheld of ['Start time', 'End time', 'Check in', 'Nominate scorekeeper', 'Print match card']) {
      await expect(menu.locator('li', { hasText: withheld })).toHaveCount(0);
    }
  });

  test('the date picker offers no day after the match this one feeds', async ({ page }) => {
    const menu = await openMenu(page, seeded.firstRoundSide);
    await menu.locator('li', { hasText: 'Schedule date' }).first().click();
    await page.locator('.chc-modal-dialog input[placeholder="YYYY-MM-DD"]').click();

    const enabledDays = page.locator('.datepicker .datepicker-cell.day:not(.disabled):not(.prev):not(.next)');
    await expect(enabledDays.first()).toBeVisible();
    // DAY1 and DAY2 only: DAY3 falls after the second-round match it feeds
    await expect(enabledDays).toHaveText(['10', '11']);
  });
});
