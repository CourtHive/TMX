import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/**
 * Journey 108 — schedule time entry cannot silently send an impossible end time.
 *
 * Reproduces the production defect behind two `ERR_INVALID_END_TIME` rejections on 2026-08-23
 * (CFS audit_log, tournament 189ab4d5). TMX's picker is a 12-hour clock which, seeded empty, opened
 * at **12:00 AM** — so an operator dialing an afternoon end time without noticing the AM/PM toggle
 * sent `02:29` for a match that started at 14:00. The server refused it, and because
 * `setMatchUpSchedule` supplies a callback, `mutationRequest` raised no toast: the client appeared
 * to do nothing at all, twice, and the end times were simply never recorded.
 *
 * `scheduleTimeFields.test.ts` covers the rules and `setMatchUpSchedule.test.ts` the error
 * surfacing. Only this layer can assert the two things that actually failed the operator: that the
 * picker **opens on a usable value**, and that a refused time **says why** instead of vanishing.
 *
 * The three tests differ in one variable — the AM/PM toggle — which is precisely the variable that
 * caused the incident.
 */

const START_TIME = '14:00';
const TIME_INPUT = '#timevalue';

async function browserToday(page: Page): Promise<string> {
  return page.evaluate(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  });
}

/**
 * One matchUp already carrying a scheduledDate and an afternoon START_TIME. Dates are today so the
 * tournament is in range and `mutationRequest` dispatches rather than raising its "Modify?" gate.
 */
async function seedScheduledMatchUp(page: Page, today: string) {
  return page.evaluate(
    async ([today, startTime]) => {
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        tournamentAttributes: { tournamentId: 'e2e-time-entry' },
        drawProfiles: [{ drawSize: 8, eventName: 'Singles' }],
        tournamentName: 'E2E Schedule Time Entry',
        startDate: today,
        endDate: today,
        nonRandom: 1,
        setState: true,
      });

      const engine = dev.factory.tournamentEngine;
      engine.setState(tournamentRecord);
      const { matchUps } = engine.allTournamentMatchUps();
      const matchUp = matchUps.find((m: any) => m.sides?.every((s: any) => s?.participantId));

      engine.executionQueue(
        [
          {
            method: 'bulkScheduleMatchUps',
            params: { matchUpIds: [matchUp.matchUpId], schedule: { scheduledDate: today, startTime } },
          },
        ],
        true,
      );

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

async function openEndTimePicker(page: Page, tournamentId: string, sideName: string) {
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToMatchUps();

  const row = page.locator(`${S.TOURNAMENT_MATCHUPS} .tabulator-row`).filter({ hasText: sideName }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });

  const menu = page.locator('.tippy-content .menu-list');
  for (let attempt = 0; attempt < 4; attempt++) {
    await row.locator('.fa-ellipsis-vertical').click();
    if (await menu.isVisible().catch(() => false)) break;
  }
  await expect(menu).toBeVisible();
  await menu.locator('li', { hasText: 'End time' }).first().click();
  await expect(page.locator('.tp-ui-modal')).toBeVisible();
}

/**
 * Set the minutes on the open picker. The hour is already on 2 from the seed, and its dial hand
 * covers the "2" tip — but the minutes need dialing, and the tips wrapper handles pointer position
 * itself, so the tip is clicked with `force` and the widget resolves the value from the coordinates.
 */
async function dialMinutes(page: Page, minutes: string) {
  const field = page.locator('input.tp-ui-minutes');
  await field.click();

  // `span.tp-ui-minutes-time` exists only on the minute face — matching it rather than any tip is
  // what keeps the click from landing on the hour face while the dial is still swapping.
  const tip = page
    .locator('.tp-ui-tips-wrapper span.tp-ui-minutes-time', { hasText: new RegExp(`^${minutes}$`) })
    .first();

  // The face swap is animated and the tips exist throughout it, so `toBeVisible` returns before the
  // widget is ready to accept a value — a click landed during the transition is simply dropped.
  await expect(tip).toBeVisible();
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.waitForTimeout(400);
    await tip.click({ force: true });
    if ((await field.inputValue()) === minutes) return;
  }
  await expect(field).toHaveValue(minutes);
}

test.describe('Journey 108 — schedule time entry', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('the end-time picker opens on the start time, with PM already selected', async ({ page }) => {
    const today = await browserToday(page);
    const { tournamentId, sideName } = await seedScheduledMatchUp(page, today);

    await openEndTimePicker(page, tournamentId, sideName);

    // The regression: an empty seed rendered "12:00 AM", leaving the toggle on AM for an afternoon
    // match. Seeding from START_TIME puts it on the right side of noon before the dial is touched.
    await expect(page.locator(TIME_INPUT)).toHaveValue('2:00 PM');
    await expect(page.locator('.tp-ui-pm')).toHaveClass(/active/);
  });

  test('an end time before the start is refused with a visible reason and never dispatched', async ({ page }) => {
    const today = await browserToday(page);
    const { tournamentId, matchUpId, sideName } = await seedScheduledMatchUp(page, today);
    const collector = createMutationCollector(page);

    await openEndTimePicker(page, tournamentId, sideName);

    // Exactly the operator's mistake: dial the minutes, but leave the meridiem on AM.
    await page.locator('.tp-ui-am').click();
    await dialMinutes(page, '30');
    await page.locator('.tp-ui-ok-btn').click();

    // Names both times and points at the cause, rather than failing silently.
    const toast = page.locator('.notification.is-danger');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('02:30');
    await expect(toast).toContainText(START_TIME);

    expect(collector.getMethodNames()).not.toContain('bulkScheduleMatchUps');
    const endTime = await page.evaluate((id) => {
      const { matchUps } = dev.factory.tournamentEngine.allTournamentMatchUps();
      return matchUps.find((m: any) => m.matchUpId === id)?.schedule?.endTime;
    }, matchUpId);
    expect(endTime).toBeUndefined();
  });

  test('the same dial with PM left selected is accepted and recorded', async ({ page }) => {
    const today = await browserToday(page);
    const { tournamentId, matchUpId, sideName } = await seedScheduledMatchUp(page, today);
    const collector = createMutationCollector(page);

    await openEndTimePicker(page, tournamentId, sideName);

    await dialMinutes(page, '30');
    await page.locator('.tp-ui-ok-btn').click();

    await collector.waitForMethod('bulkScheduleMatchUps');
    await expect(page.locator('.notification.is-danger')).toHaveCount(0);

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
