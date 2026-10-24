import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { todayLocal } from '../helpers/dates';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 150 — the scheduling workspace does its per-card engine work once, and only for cards
 * someone can see.
 *
 * Reported from production on Battle of Boca: opening the schedule page ran hundreds of
 * `getParticipantRest` / `getMatchUpReadiness` calls, and the whole sequence twice. Each card grades
 * readiness and rest, so every redundant card build was two engine calls. Rest is now one
 * `getParticipantsRest` per pass, answering every matchUp on the day, so a card build costs one
 * readiness call and the rest count is a count of PASSES. Pinned here:
 *
 *  1. One navigation renders the page once. The router ran EVERY matching route, and
 *     `/scheduling` matches its own route and the `:selectedTab` catch-all.
 *  2. The catalog behind the Scheduled tab is not graded; showing it grades it.
 *  3. Selecting a Scheduled card moves the highlight; it does not rebuild the panel.
 *  4. A refresh notifies the page once, not once per pushed slice.
 *  5. A collapsed group builds no cards.
 */

const DATE = todayLocal();
const SCHEDULED_PANEL = '[data-sidebar-panel="scheduled"]';
const SCHEDULED_CARD = `${SCHEDULED_PANEL} .spl-matchup-card`;
const UNSCHEDULED_TAB = 'button[data-sidebar-tab="unscheduled"]';
const BATCHED_REST = 'getParticipantsRest';
const GRADED = [BATCHED_REST, 'getMatchUpReadiness'];

/** 3 × 32-draw events; every first-round matchUp gets a date and time but no court. */
async function seedScheduledWithoutCourts(page: Page): Promise<{ tournamentId: string; scheduled: number }> {
  return page.evaluate(
    async ({ date }) => {
      await dev.tmx2db.initDB();
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        tournamentName: 'E2E Render Economy',
        tournamentAttributes: { tournamentId: 'e2e-render-economy', startDate: date, endDate: date },
        drawProfiles: [{ drawSize: 32 }, { drawSize: 32 }, { drawSize: 32 }],
        venueProfiles: [{ courtsCount: 8, venueName: 'Economy Venue' }],
      });
      const round1 = dev.factory.competitionEngine
        .allTournamentMatchUps({})
        .matchUps.filter((m: any) => m.roundNumber === 1 && m.matchUpStatus !== 'BYE');
      round1.forEach((m: any, i: number) =>
        dev.factory.tournamentEngine.addMatchUpScheduleItems({
          matchUpId: m.matchUpId,
          drawId: m.drawId,
          schedule: { scheduledDate: date, scheduledTime: `${String(9 + (i % 4)).padStart(2, '0')}:00` },
        }),
      );
      await dev.tmx2db.addTournament(dev.factory.tournamentEngine.getTournament().tournamentRecord);
      return { tournamentId: tournamentRecord.tournamentId as string, scheduled: round1.length };
    },
    { date: DATE },
  );
}

/** Count engine calls by method from here on, through the factory's dev log. */
async function startCounting(page: Page): Promise<void> {
  await page.evaluate(() => {
    const g = globalThis as any;
    g.__engineCalls = {};
    dev.factory.globalState.setGlobalLog(({ log }: any) => {
      if (!log?.method) return;
      g.__engineCalls[log.method] = (g.__engineCalls[log.method] ?? 0) + 1;
      // How many matchUps each batched rest call answered, so a pass that badges nothing on the
      // day it covers is visible as well as a pass that ran twice.
      if (log.params?.requests)
        g.__engineCalls.restRequests = (g.__engineCalls.restRequests ?? 0) + log.params.requests.length;
    });
    dev.factory.globalState.setDevContext({ perf: 0, params: ['getParticipantsRest'] });
  });
}

const readCounts = (page: Page): Promise<Record<string, number>> =>
  page.evaluate(() => ({ ...(globalThis as any).__engineCalls }));

/**
 * The calls made since the last take, once they have stopped arriving. A fixed wait was too short
 * on a cold dev server, letting one step's calls land in the next step's count.
 */
async function takeCounts(page: Page): Promise<Record<string, number>> {
  let previous = '';
  await expect
    .poll(
      async () => {
        const current = JSON.stringify(await readCounts(page));
        const settled = current === previous;
        previous = current;
        return settled;
      },
      { intervals: [250], timeout: 15_000 },
    )
    .toBe(true);
  return page.evaluate(() => {
    const g = globalThis as any;
    const counts = g.__engineCalls;
    g.__engineCalls = {};
    return counts;
  });
}

const graded = (counts: Record<string, number>) => GRADED.map((m) => counts[m] ?? 0);

test.describe('Journey 150 — schedule render economy', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      dev.factory.globalState.setDevContext(false);
      dev.factory.globalState.setGlobalLog();
    });
  });

  test('grades each visible card once, and nothing hidden, selected or collapsed', async ({ page }) => {
    const { tournamentId, scheduled } = await seedScheduledWithoutCourts(page);
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);

    // 1 + 2: scheduled-but-unplaced matchUps open the Scheduled tab; the catalog behind it is hidden.
    await startCounting(page);
    await tournament.navigateToScheduling();
    await expect(page.locator(SCHEDULED_CARD)).toHaveCount(scheduled);
    const opened = await takeCounts(page);
    // One render, so one rest call, answering at least every card on the day; the per-card call is
    // gone entirely, which a regression to it would break here.
    expect(graded(opened)).toEqual([1, scheduled]);
    expect(opened.restRequests).toBeGreaterThanOrEqual(scheduled);
    expect(opened.getParticipantRest ?? 0).toBe(0);

    // 3: selection moves the highlight on the same card element. The Inspector's sections and the
    // hover highlight grade the one selected matchUp (a few calls, however many cards there are);
    // a rebuild would grade all of them again.
    const card = page.locator(SCHEDULED_CARD).nth(3);
    await card.evaluate((el) => ((el as any).__probe = true));
    await card.click();
    await expect(card).toHaveClass(/selected/);
    expect(await card.evaluate((el) => (el as any).__probe)).toBe(true);
    const [rest, readiness] = graded(await takeCounts(page));
    expect(rest).toBeLessThanOrEqual(4);
    expect(readiness).toBeLessThanOrEqual(4);

    // 4: a refresh (what every schedule mutation ends with) pushes the catalog, the dates and the
    // issues as one store write. The Scheduled cards are graded once and the Inspector renders once
    // for the selection (~3 readiness, ~2 rest passes); written one by one it rendered four times,
    // measured at 48+9 readiness and 48+5 per-card rest calls.
    await page.evaluate(() => (globalThis as any).dev.tournamentContext.refreshActiveTable());
    const [refreshRest, refreshReadiness] = graded(await takeCounts(page));
    expect(refreshRest).toBeGreaterThanOrEqual(1);
    expect(refreshRest).toBeLessThanOrEqual(3);
    expect(refreshReadiness).toBeGreaterThanOrEqual(scheduled);
    expect(refreshReadiness).toBeLessThanOrEqual(scheduled + 3);

    // 5: collapsing a group rebuilds the panel without that group's cards.
    const firstGroupHeader = page.locator(`${SCHEDULED_PANEL} .sp-group-header`).first();
    const firstGroupSize = Number((await firstGroupHeader.textContent())?.match(/\((\d+)\)/)?.[1]);
    expect(firstGroupSize).toBeGreaterThan(0);
    await firstGroupHeader.click();
    await expect(page.locator(SCHEDULED_CARD)).toHaveCount(scheduled - firstGroupSize);
    // One rest pass for whatever cards remain, and none when the collapse leaves none: this seed's
    // dates all fall in one group, so collapsing it empties the panel.
    const remaining = scheduled - firstGroupSize;
    expect(graded(await takeCounts(page))).toEqual([Math.min(1, remaining), remaining]);

    // 2, the other half: showing the catalog grades its cards.
    await page.locator(UNSCHEDULED_TAB).click();
    const [catalogRest] = graded(await takeCounts(page));
    expect(catalogRest).toBeGreaterThan(0);
  });
});
