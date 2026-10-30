import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/**
 * Journey 186 — the matchUp actions menu's schedule lock, and times bounded by linked matchUps (CA, 2026-10-30).
 *
 * - Locking a placed match withdraws its date, time and clear-schedule items; unlocking restores them.
 * - A first-round match may not be timed at or after the second-round match it feeds on the same day: the menu says
 *   why and writes nothing, while a time before it saves.
 * - A recorded end may not run past the recorded start of the match it feeds, while one before it saves.
 *
 * Journey 185 covers the walkover menu and the date picker's bounds; `matchUpMenuGates.test.ts` covers
 * `timeOutsideBounds` itself. Only this layer shows that the director's picker reaches it.
 */

const MENU = '.tippy-content .menu-list';
const DAY1 = '2026-11-10';
const DAY2 = '2026-11-11';
const SCHEDULE_WRITES = ['addMatchUpScheduleItems', 'bulkScheduleMatchUps'];

type Schedule = Record<string, string>;
type Seeded = { tournamentId: string; matchUpId: string; sideName: string };

/**
 * A draw of 8 on DAY1-DAY2. The first-round match at position 1 gets `first`; the second-round match it feeds gets
 * `feeds`. With `played`, both first-round matches feeding it are completed 6-1 6-1 first.
 */
async function seed(page: Page, { first, feeds, played }: { first: Schedule; feeds: Schedule; played?: boolean }) {
  return page.evaluate(
    async ([day1, day2, first, feeds, played]) => {
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        tournamentAttributes: { tournamentId: 'e2e-menu-lock-linked-times' },
        drawProfiles: [{ drawSize: 8, eventName: 'Singles' }],
        tournamentName: 'E2E Menu Lock And Linked Times',
        startDate: day1,
        endDate: day2,
        nonRandom: 1,
        setState: true,
      });

      const engine = dev.factory.tournamentEngine;
      engine.setState(tournamentRecord);
      const at = (roundNumber: number, roundPosition: number) =>
        engine
          .allTournamentMatchUps()
          .matchUps.find((m: any) => m.roundNumber === roundNumber && m.roundPosition === roundPosition);

      const matchUp = at(1, 1);
      const sibling = at(1, 2);
      const next = at(2, 1);
      const { outcome } = dev.factory.mocksEngine.generateOutcomeFromScoreString({
        scoreString: '6-1 6-1',
        winningSide: 1,
      });
      const schedule = (m: any, items: Record<string, string>) => ({
        method: 'addMatchUpScheduleItems',
        params: { drawId: m.drawId, matchUpId: m.matchUpId, schedule: items },
      });
      const complete = (m: any) => ({
        method: 'setMatchUpStatus',
        params: { drawId: m.drawId, matchUpId: m.matchUpId, outcome },
      });

      const result = engine.executionQueue(
        [schedule(matchUp, first), ...(played ? [complete(matchUp), complete(sibling)] : []), schedule(next, feeds)],
        true,
      );
      if (!result.success) throw new Error(`seed failed: ${JSON.stringify(result.error)}`);

      const updated = engine.getTournament().tournamentRecord;
      await dev.load(updated);
      return {
        tournamentId: updated.tournamentId as string,
        matchUpId: matchUp.matchUpId as string,
        // the loser: the winner's name is in the next round too
        sideName: matchUp.sides.find((s: any) => s.sideNumber === 2).participant.participantName as string,
      };
    },
    [DAY1, DAY2, first, feeds, !!played] as const,
  ) as Promise<Seeded>;
}

async function openMenu(page: Page, { tournamentId, sideName }: Seeded) {
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToMatchUps();

  const row = page
    .locator(`${S.TOURNAMENT_MATCHUPS} .tabulator-row`)
    .filter({ hasText: sideName })
    .filter({ hasText: 'Quarterfinal' })
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

/** Open the menu item's time picker, dial the minutes and accept. */
async function pickTime(page: Page, seeded: Seeded, item: string, minutes: string) {
  const menu = await openMenu(page, seeded);
  await menu.locator('li', { hasText: item }).first().click();
  await expect(page.locator('.tp-ui-modal')).toBeVisible();
  await dialMinutes(page, minutes);
  await page.locator('.tp-ui-ok-btn').click();
}

function storedSchedule(page: Page, matchUpId: string) {
  return page.evaluate((id) => {
    const { matchUps } = dev.factory.tournamentEngine.allTournamentMatchUps();
    return matchUps.find((m: any) => m.matchUpId === id)?.schedule ?? {};
  }, matchUpId);
}

test.describe('Journey 186 — the matchUp menu: schedule lock and linked times', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('locking withdraws the date, time and clear items; unlocking restores them', async ({ page }) => {
    const seeded = await seed(page, { first: { scheduledDate: DAY1, scheduledTime: '09:00' }, feeds: {} });
    const placement = ['Schedule date', 'Schedule time', 'Clear schedule'];

    let menu = await openMenu(page, seeded);
    for (const item of placement) await expect(menu.locator('li', { hasText: item })).toHaveCount(1);
    await expect(menu.locator('li', { hasText: 'Unlock schedule' })).toHaveCount(0);
    await menu.locator('li', { hasText: 'Lock to this slot' }).click();

    await expect.poll(async () => !!(await storedSchedule(page, seeded.matchUpId)).lock).toBe(true);
    menu = await openMenu(page, seeded);
    await expect(menu.locator('li', { hasText: 'Unlock schedule' })).toHaveCount(1);
    for (const item of placement) await expect(menu.locator('li', { hasText: item })).toHaveCount(0);
    await menu.locator('li', { hasText: 'Unlock schedule' }).click();

    await expect.poll(async () => !!(await storedSchedule(page, seeded.matchUpId)).lock).toBe(false);
    menu = await openMenu(page, seeded);
    for (const item of placement) await expect(menu.locator('li', { hasText: item })).toHaveCount(1);
  });

  test('a time at or after the match this one feeds is refused, and one before it saved', async ({ page }) => {
    const seeded = await seed(page, {
      first: { scheduledDate: DAY1, scheduledTime: '09:00' },
      feeds: { scheduledDate: DAY1, scheduledTime: '09:15' },
    });
    const collector = createMutationCollector(page);

    await pickTime(page, seeded, 'Schedule time', '30');
    await expect(page.locator('.notification.is-danger')).toContainText('must come before 09:15');
    expect(SCHEDULE_WRITES.some((method) => collector.hasMethod(method))).toBe(false);
    expect((await storedSchedule(page, seeded.matchUpId)).scheduledTime).toBe('09:00');

    await pickTime(page, seeded, 'Schedule time', '10');
    await expect.poll(async () => (await storedSchedule(page, seeded.matchUpId)).scheduledTime).toBe('09:10');
  });

  test('an end past the recorded start of the match this one feeds is refused, and one before it saved', async ({
    page,
  }) => {
    const seeded = await seed(page, {
      first: { scheduledDate: DAY1, startTime: '10:00' },
      feeds: { scheduledDate: DAY1, startTime: '10:15' },
      played: true,
    });
    const collector = createMutationCollector(page);

    await pickTime(page, seeded, 'End time', '30');
    await expect(page.locator('.notification.is-danger')).toContainText('must come before 10:15');
    expect(SCHEDULE_WRITES.some((method) => collector.hasMethod(method))).toBe(false);
    expect((await storedSchedule(page, seeded.matchUpId)).endTime).toBeUndefined();

    await pickTime(page, seeded, 'End time', '10');
    await expect.poll(async () => (await storedSchedule(page, seeded.matchUpId)).endTime).toBe('10:10');
  });
});
