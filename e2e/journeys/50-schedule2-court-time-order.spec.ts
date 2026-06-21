import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 50 — Schedule2 court time/order issue
 *
 * With "time travels with the matchUp", a court's scheduledTimes can end up out
 * of order (a later courtOrder at an equal/earlier time). proConflicts ignores
 * scheduledTime, so TMX surfaces this as a soft WARN in the grid action bar's
 * issues popover (detectCourtTimeOrderIssues + buildIssues).
 *
 * These cover the load-time wiring end-to-end: detector → buildIssues → action
 * bar issues button + popover. (The action bar is built at render time; whether
 * it should also live-refresh after a drag is tracked separately — see
 * Mentat/TASKS.md.)
 *
 * The pure detector has dedicated unit coverage in courtTimeOrderIssues.test.ts.
 */

const DATE = new Date().toISOString().slice(0, 10);
const STRIP_SELECTOR = '.spl-active-strip';
const ISSUES_BUTTON = 'button:has(i.fa-triangle-exclamation)';

/** Dispatch a native HTML5 drag/drop using one shared DataTransfer so the
 *  source cell's dragstart payload is readable by the drop target. */
async function dispatchDnD(page: Page, sourceSelector: string, targetSelector: string): Promise<void> {
  await page.evaluate(
    ({ s, t }) => {
      const source = document.querySelector(s);
      const target = document.querySelector(t);
      if (!source || !target) {
        throw new Error(`DnD selectors not found (source=${!!source}, target=${!!target}): ${s} -> ${t}`);
      }
      const dt = new DataTransfer();
      const fire = (el: Element, type: string) =>
        el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
      fire(source, 'dragstart');
      fire(target, 'dragover');
      fire(target, 'drop');
      fire(source, 'dragend');
    },
    { s: sourceSelector, t: targetSelector },
  );
}

/** Seed a tournament and schedule N matchUps onto one court at courtOrder 1..N,
 *  with the given (optional) times — in a single persist to avoid save races. */
async function seedOneCourt(
  page: Page,
  times: (string | undefined)[],
): Promise<{ tournamentId: string; courtId: string; matchUpIds: string[] }> {
  return page.evaluate(
    async ({ date, times }) => {
      await dev.tmx2db.initDB();
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        setState: true,
        tournamentName: 'E2E Time Order',
        tournamentAttributes: { tournamentId: 'e2e-time-order', startDate: date, endDate: date },
        participantsProfile: { scaledParticipantsCount: 16 },
        drawProfiles: [{ eventName: 'TO Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
        venueProfiles: [{ courtsCount: 4, venueName: 'TO Venue' }],
      });

      const court = dev.factory.tournamentEngine.getVenuesAndCourts().venues[0].courts[0];
      const playable = (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).filter(
        (m: any) =>
          m.matchUpStatus !== 'BYE' &&
          (m.sides || []).filter((s: any) => s.participantId || s.participant?.participantId).length === 2,
      );

      const matchUpIds: string[] = [];
      times.forEach((t, i) => {
        const mu = playable[i];
        dev.factory.tournamentEngine.addMatchUpScheduleItems({
          matchUpId: mu.matchUpId,
          drawId: mu.drawId,
          schedule: {
            scheduledDate: date,
            courtId: court.courtId,
            venueId: court.venueId,
            courtOrder: i + 1,
            ...(t ? { scheduledTime: t } : {}),
          },
        });
        matchUpIds.push(mu.matchUpId);
      });

      const rec = dev.factory.tournamentEngine.getTournament().tournamentRecord;
      await dev.tmx2db.addTournament(rec);
      return { tournamentId: tournamentRecord.tournamentId as string, courtId: court.courtId as string, matchUpIds };
    },
    { date: DATE, times },
  );
}

test.describe('Journey 50 — Schedule2 court time/order issue', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('an out-of-order court time surfaces a WARN issue in the action bar', async ({ page }) => {
    // courtOrder 1 @ 14:00, courtOrder 2 @ 09:00 → later order, earlier time.
    const seed = await seedOneCourt(page, ['14:00', '09:00']);

    const tournament = new TournamentPage(page);
    await tournament.goto(seed.tournamentId);
    await tournament.navigateToSchedule2();
    await page.waitForSelector(STRIP_SELECTOR, { timeout: 10_000 });

    const issuesBtn = page.locator(ISSUES_BUTTON);
    await expect(issuesBtn).toBeVisible({ timeout: 8_000 });

    await issuesBtn.click();
    await expect(page.getByText('Scheduling Issues (1)')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/courtTimeOrderConflict/)).toBeVisible();
    await expect(page.getByText('WARN').first()).toBeVisible();
  });

  test('monotonic court times produce no issue', async ({ page }) => {
    // 08:00 then 09:00 — strictly increasing with courtOrder.
    const seed = await seedOneCourt(page, ['08:00', '09:00']);

    const tournament = new TournamentPage(page);
    await tournament.goto(seed.tournamentId);
    await tournament.navigateToSchedule2();
    await page.waitForSelector(STRIP_SELECTOR, { timeout: 10_000 });

    // Two independent first-round matchUps at different courtOrders produce no
    // proConflicts issue, and the times are in order — so no issues button.
    await expect(page.locator(ISSUES_BUTTON)).toHaveCount(0);
  });

  test('a swap that puts a court out of order raises the issue live', async ({ page }) => {
    // Monotonic to start: courtOrder 1 @ 09:00, courtOrder 2 @ 10:00 → no issue.
    const seed = await seedOneCourt(page, ['09:00', '10:00']);
    const court = seed.courtId;

    const tournament = new TournamentPage(page);
    await tournament.goto(seed.tournamentId);
    await tournament.navigateToSchedule2();
    await page.waitForSelector(STRIP_SELECTOR, { timeout: 10_000 });
    await expect(page.locator(ISSUES_BUTTON)).toHaveCount(0);

    // Swap order 2 (10:00) onto order 1 (09:00). Times travel with the matchUps,
    // so afterwards order 1 holds 10:00 and order 2 holds 09:00 → out of order.
    await page.waitForSelector(`[data-court-id="${court}"][data-court-order="1"]`);
    await dispatchDnD(
      page,
      `[data-court-id="${court}"][data-court-order="2"]`,
      `[data-court-id="${court}"][data-court-order="1"]`,
    );

    // The action bar re-renders the issues cluster in place — the WARN appears
    // without a full page/tab re-render.
    const issuesBtn = page.locator(ISSUES_BUTTON);
    await expect(issuesBtn).toBeVisible({ timeout: 8_000 });
    await issuesBtn.click();
    await expect(page.getByText(/courtTimeOrderConflict/)).toBeVisible({ timeout: 5_000 });
  });
});
