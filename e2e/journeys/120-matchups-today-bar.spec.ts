import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';
import { todayLocal } from '../helpers/dates';

/**
 * Journey 120 — MatchUps page "Today" bar
 *
 * The Today bar shipped in TMX #1284 with unit tests only; the browser gap was
 * flagged when it merged and has been open since. It is the matchUps page's
 * day-of-play dashboard: six segments (complete / live / suspended / called /
 * readyToScore / notReady) over the matches scheduled for today, each one a
 * filter driver.
 *
 * The property worth a browser to prove is **count coherence** — the number
 * printed on a segment equals the number of rows you get when you click it.
 * That promise spans three modules that a unit test exercises separately:
 * `aggregateToday` counts with `classifyTodayBucket`, the Tabulator filter
 * re-derives the bucket per row through the same classifier, and the bar and
 * the table have to be looking at the same day. A drift between any two shows
 * up here and nowhere else.
 *
 * `called` gets its own assertions because it is the segment with a real
 * dependency on stored data rather than on status alone: it splits the
 * ready-to-score population by whether a `calledAt` stamp exists FOR THE DAY
 * the match is scheduled on.
 */

const MATCHUPS = `#${'tournamentMatchUps'}`; // S.TOURNAMENT_MATCHUPS
const ROWS = `${MATCHUPS} .tabulator-row`;
/** The Today bar is the second `.chc-sb` sibling; the competitiveness bar has its own class. */
const TODAY_BAR = '.chc-sb';
const seg = (key: string) => `${TODAY_BAR} .chc-sb__seg[data-key="${key}"]`;
const TOGGLE = 'button:has(i.fa-arrow-right-arrow-left)';

interface Seed {
  tournamentId: string;
  today: string;
}

/**
 * One draw, every round-1 matchUp scheduled for today, arranged so that four of
 * the six buckets are non-empty and no two of them hold the same count — a bar
 * where every segment reads `1` cannot tell a coherent filter from a lucky one.
 *
 *   complete      1  — a scored matchUp
 *   called        1  — ready to score, with a calledAt stamp for today
 *   readyToScore  2  — ready, not yet called
 *   notReady      2  — round 2, scheduled but with no participants yet
 *
 * Six rows in all: the final is deliberately left unscheduled, so it sits
 * outside the Today date scope and is not one of them.
 */
async function seedTodayBar(page: Page): Promise<Seed> {
  const today = todayLocal();
  const tournamentId = await page.evaluate(async (date) => {
    await dev.tmx2db.initDB();
    const engine = dev.factory.tournamentEngine;

    dev.factory.mocksEngine.generateTournamentRecord({
      nonRandom: 1,
      setState: true,
      tournamentName: 'E2E Today Bar',
      tournamentAttributes: { tournamentId: 'e2e-today-bar', startDate: date, endDate: date },
      drawProfiles: [
        {
          eventName: 'Today Singles',
          drawSize: 8,
          drawType: 'SINGLE_ELIMINATION',
          drawId: 'e2eTodayDraw',
          // One completed matchUp, so the `complete` segment has something in it
          // that is not merely a status string.
          outcomes: [{ roundNumber: 1, roundPosition: 1, scoreString: '6-1 6-2', winningSide: 1 }],
        },
      ],
    });

    const drawId = 'e2eTodayDraw';
    const schedule = (matchUpId: string, scheduledTime: string) =>
      engine.addMatchUpScheduleItems({
        schedule: { scheduledDate: date, scheduledTime },
        removePriorValues: true,
        matchUpId,
        drawId,
      });

    const all = engine.allTournamentMatchUps({}).matchUps || [];
    const roundOne = all.filter((m: any) => m.roundNumber === 1 && m.matchUpStatus !== 'BYE');
    const roundTwo = all.filter((m: any) => m.roundNumber === 2);

    // Everything on the board today: the bar aggregates by scheduledDate, so an
    // unscheduled matchUp would simply be absent rather than counted as notReady.
    roundOne.forEach((matchUp: any) => schedule(matchUp.matchUpId, '09:00'));
    roundTwo.forEach((matchUp: any) => schedule(matchUp.matchUpId, '13:00'));

    // Exactly one called match. The stamp is today's, which is the condition the
    // classifier actually tests — a stamp from another day leaves the row in
    // readyToScore.
    const called = roundOne.find((m: any) => !m.winningSide);
    engine.setMatchUpCalledAt({ matchUpId: called.matchUpId, drawId, calledAt: new Date().toISOString() });

    const record = engine.getTournament().tournamentRecord;
    await dev.tmx2db.addTournament(record);
    return record.tournamentId as string;
  }, today);

  return { tournamentId, today };
}

/** Switch the bar from Competitiveness to Today and wait for it to paint. */
async function showTodayBar(page: Page): Promise<void> {
  await page.locator(TOGGLE).click();
  await expect(page.locator(seg('called'))).toBeVisible();
}

/** The count a segment prints, or 0 when it renders empty. */
async function segmentCount(page: Page, key: string): Promise<number> {
  const text = (await page.locator(seg(key)).textContent()) ?? '';
  return Number(text.trim() || 0);
}

test.describe('Journey 120 — matchUps Today bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    // Filter state persists per tournament; start from an unfiltered table.
    await page.evaluate(() => localStorage.clear());
  });

  test('renders the called bucket as its own segment', async ({ page }) => {
    const seed = await seedTodayBar(page);
    const tournament = new TournamentPage(page);
    await tournament.goto(seed.tournamentId);
    await tournament.navigateToMatchUps();
    await page.waitForSelector(ROWS, { state: 'visible', timeout: 10_000 });

    await showTodayBar(page);

    // The stamped matchUp, and only that one, is called.
    expect(await segmentCount(page, 'called')).toBe(1);
    // The title carries the label, which is what the operator hovers to read.
    await expect(page.locator(seg('called'))).toHaveAttribute('title', /1$/);
    // Its neighbours are populated too, so `called` is a split of the ready
    // population rather than the whole of it.
    expect(await segmentCount(page, 'readyToScore')).toBe(2);
    expect(await segmentCount(page, 'complete')).toBe(1);
  });

  test('clicking a segment drives the status filter and narrows the table to it', async ({ page }) => {
    const seed = await seedTodayBar(page);
    const tournament = new TournamentPage(page);
    await tournament.goto(seed.tournamentId);
    await tournament.navigateToMatchUps();
    await page.waitForSelector(ROWS, { state: 'visible', timeout: 10_000 });

    await showTodayBar(page);
    await page.locator(seg('called')).click();

    await expect(page.locator(seg('called'))).toHaveClass(/is-active/);
    await expect(page.locator(ROWS)).toHaveCount(1);

    // Clicking the active segment again releases the filter rather than
    // re-applying it — the deselect path that the bar repaints explicitly.
    await page.locator(seg('called')).click();
    await expect(page.locator(seg('called'))).not.toHaveClass(/is-active/);
    // Back to every match scheduled today — the unscheduled final stays out,
    // because entering the Today view applies the `today` date filter too.
    await expect(page.locator(ROWS)).toHaveCount(6);
  });

  test('the number on every segment equals the rows clicking it produces', async ({ page }) => {
    const seed = await seedTodayBar(page);
    const tournament = new TournamentPage(page);
    await tournament.goto(seed.tournamentId);
    await tournament.navigateToMatchUps();
    await page.waitForSelector(ROWS, { state: 'visible', timeout: 10_000 });

    await showTodayBar(page);

    // The promise the bar makes, checked across every populated bucket rather
    // than a representative one: the counts come from `aggregateToday` and the
    // rows from a Tabulator filter, and only a browser puts both in the same
    // frame.
    const counts: Record<string, number> = {};
    for (const key of ['complete', 'live', 'suspended', 'called', 'readyToScore', 'notReady']) {
      counts[key] = await segmentCount(page, key);
    }
    // Guard against a vacuous pass: a bar of empty segments would satisfy the
    // loop below without exercising anything.
    expect(Object.values(counts).filter(Boolean).length).toBeGreaterThanOrEqual(3);

    for (const [key, count] of Object.entries(counts)) {
      if (!count) continue;
      await page.locator(seg(key)).click();
      await expect(page.locator(ROWS), `${key} segment reads ${count}`).toHaveCount(count);
      await page.locator(seg(key)).click();
    }
  });
});
