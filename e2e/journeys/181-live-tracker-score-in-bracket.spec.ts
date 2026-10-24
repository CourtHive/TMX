/**
 * Journey 181 — a live tracker's score shows wherever the TD looks, and gives way to the official one
 *
 * A tracker (epixodic, or a provider's own app such as IONSport) streams each point to the
 * score-relay's `/tracker` namespace; the relay fans it out on `/live`, which TMX subscribes to
 * per tournament. The TD used to get only a green dot — "something is being tracked" — with no
 * way to see the score, so no way to judge how close a match is to finishing.
 *
 * Here the relay is faked at the socket (`installFakeScoreRelay`), so TMX's real socket.io client
 * receives the frames. The matchUp is on a court today. Verifies:
 *   - bracket: the cell shows the live sets + game points, and the renderer's own LIVE pill,
 *   - a later frame updates it in place,
 *   - matchUps table: the score cell shows the same score, tagged LIVE,
 *   - schedule (today): the grid cell shows LIVE beside the score, and the Now strip calls the court LIVE,
 *     not NEXT,
 *   - schedule (another day): no live score, even for a match with live frames — that is planning, not now,
 *   - entering the official score replaces it and LIVE goes.
 */
import { installFakeScoreRelay, pointScoreRelayAtApp, type FakeScoreRelay } from '../helpers/fakeScoreRelay';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedScheduledMatchUp } from '../helpers/seedScheduledMatchUp';
import { daysFromTodayLocal, todayLocal } from '../helpers/dates';
import { TournamentPage } from '../pages/TournamentPage';
import { enterScore } from '../helpers/enterScore';
import { test, expect } from '@playwright/test';

const TOURNAMENT_ID = 'e2e-live-tracker-score';
const DATE = todayLocal();
const NEXT_DATE = daysFromTodayLocal(1);

test.describe('Journey 181 — live tracker score', () => {
  let relay: FakeScoreRelay;

  test.beforeEach(async ({ page }) => {
    relay = await installFakeScoreRelay(page); // before goto — see the helper
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await pointScoreRelayAtApp(page);
  });

  test('a tracked match shows its live score until the official result is entered', async ({ page }) => {
    const seed = await seedScheduledMatchUp(page, { tournamentId: TOURNAMENT_ID, date: DATE, nextDate: NEXT_DATE });
    const tournamentPage = new TournamentPage(page);
    // TMX opened the /live socket and subscribed to this tournament. That is the last step of opening it, so
    // navigating only after it keeps the open's own route to the overview from landing on top of ours.
    await expect.poll(() => relay.subscribedTo(), { timeout: 10_000 }).toBe(TOURNAMENT_ID);
    const drawRoute = `/#/tournament/${TOURNAMENT_ID}/event/${seed.eventId}/draw/${seed.drawId}`;
    await page.goto(drawRoute);

    // ── Bracket ──
    const cell = page.locator(`.tmx-m[id="${seed.matchUpId}"]`);
    const side1 = cell.locator('.tmx-sd[sideNumber="1"] .tmx-scr');
    const side2 = cell.locator('.tmx-sd[sideNumber="2"] .tmx-scr');
    // The renderer's own status pill: an IN_PROGRESS matchUp gets one per side.
    const livePill = cell.getByText('LIVE', { exact: true });
    await expect(cell).toBeVisible();
    await expect(livePill).toHaveCount(0);

    relay.sendScore({
      matchUpId: seed.matchUpId,
      tournamentId: TOURNAMENT_ID,
      matchUpStatus: 'IN_PROGRESS',
      score: { sets: [{ setNumber: 1, side1Score: 4, side2Score: 3, side1PointScore: '30', side2PointScore: '15' }] },
    });

    await expect(livePill).toHaveCount(2);
    await expect(side1).toContainText('4');
    await expect(side1).toContainText('30');
    await expect(side2).toContainText('3');
    await expect(side2).toContainText('15');

    // The next point arrives: the bracket follows it.
    relay.sendScore({
      matchUpId: seed.matchUpId,
      tournamentId: TOURNAMENT_ID,
      matchUpStatus: 'IN_PROGRESS',
      score: { sets: [{ setNumber: 1, side1Score: 5, side2Score: 3 }] },
    });
    await expect(side1).toContainText('5');
    await expect(side1).not.toContainText('30');

    // ── MatchUps table ──
    await tournamentPage.navigateToMatchUps();
    const row = page.locator('.tabulator-row', { has: page.locator('.tmx-live-tag') });
    await expect(row).toHaveCount(1);
    await expect(row.locator('.tmx-live-score')).toHaveText('5-3');

    // ── Schedule: grid cell + Now strip ──
    await tournamentPage.navigateToScheduling();
    const gridCell = page.locator(`[data-court-order] .spl-grid-cell[data-matchup-id="${seed.matchUpId}"]`);
    await expect(gridCell).toBeVisible({ timeout: 10_000 });
    await expect(gridCell).toContainText('5-3');
    // LIVE sits on the score line: the cell's top line is the event and round. (Only the Now strip puts it
    // top-right, in its own state pill.)
    await expect(gridCell.locator('.spl-grid-cell__score .tmx-live-tag')).toHaveText('LIVE');
    const stripCell = page.locator('.spl-active-strip-cell', {
      has: page.locator(`.spl-grid-cell[data-matchup-id="${seed.matchUpId}"]`),
    });
    await expect(stripCell).toHaveClass(/state-in-progress/);
    await expect(stripCell.locator('.spl-active-strip-state-pill')).toHaveText('LIVE');

    // ── Another day is planning, not now: a live frame for tomorrow's match shows nothing there ──
    relay.sendScore({
      matchUpId: seed.nextDayMatchUpId,
      tournamentId: TOURNAMENT_ID,
      matchUpStatus: 'IN_PROGRESS',
      score: { sets: [{ setNumber: 1, side1Score: 2, side2Score: 2 }] },
    });
    await page.goto(`/#/tournament/${TOURNAMENT_ID}/scheduling/${NEXT_DATE}/grid`);
    const nextDayCell = page.locator(`[data-court-order] .spl-grid-cell[data-matchup-id="${seed.nextDayMatchUpId}"]`);
    await expect(nextDayCell).toBeVisible({ timeout: 10_000 });
    await expect(nextDayCell.locator('.tmx-live-tag')).toHaveCount(0);
    await expect(nextDayCell).not.toContainText('2-2');

    // ── The official result replaces the tracker's ──
    await page.goto(drawRoute);
    await expect(livePill).toHaveCount(2);
    await enterScore(page, {
      matchUpId: seed.matchUpId,
      drawId: seed.drawId,
      scoreString: '6-3 6-2',
      winningSide: 1,
      refreshActive: true,
    });
    await expect(livePill).toHaveCount(0);
    await expect(side1).toContainText('6');
    await expect(side2).toContainText('2');
  });
});
