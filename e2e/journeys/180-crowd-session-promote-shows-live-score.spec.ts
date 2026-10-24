/**
 * Journey 180 — a crowd session is visible without opening a menu, and promoting it shows its score live
 *
 * A provider's own scoring app (IONSport) mints a provider-scoring token for a scorer it vouches for
 * and streams points to the relay's `/crowd` namespace. That is a crowd session: unofficial, and
 * invisible to the TD until surfaced. Promoting it makes it the feed the TD follows.
 *
 * Two gaps this closes: a crowd session had no indicator outside the matchUps-table ⋮ (nothing on the
 * bracket or the schedule), and Promote changed nothing anyone could see — it set `trusted` on the
 * relay and no client read it.
 *
 * The relay's REST API is faked (`installFakeScoreRelay`), with one provider-attested, verified
 * session on a matchUp that is on a court today. Verifies:
 *   - bracket: a 👥 1 badge, and the unpromoted crowd score is NOT shown as live,
 *   - clicking the badge opens the trackers dialog; Promote is offered for the verified scorer,
 *   - after Promote: the badge turns trusted (✓), and the session's score shows LIVE in the bracket,
 *   - the next poll carries the session's newer score into the bracket,
 *   - schedule: the grid cell carries the trusted badge, LIVE and the score; the Now strip reads LIVE.
 */
import { installFakeScoreRelay, pointScoreRelayAtApp, type FakeScoreRelay } from '../helpers/fakeScoreRelay';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedScheduledMatchUp } from '../helpers/seedScheduledMatchUp';
import { daysFromTodayLocal, todayLocal } from '../helpers/dates';
import { TournamentPage } from '../pages/TournamentPage';
import { test, expect } from '@playwright/test';

const TOURNAMENT_ID = 'e2e-crowd-session-promote';
const DATE = todayLocal();
const NEXT_DATE = daysFromTodayLocal(1);
const SESSION_ID = 'ionsport-session-1';

function ionSportSession(matchUpId: string) {
  return {
    sessionId: SESSION_ID,
    matchUpId,
    tournamentId: TOURNAMENT_ID,
    userId: 'provider-ionsport',
    clientId: 'ionsport-app',
    currentScore: { sets: [{ setNumber: 1, side1Score: 3, side2Score: 2 }], matchUpStatus: 'IN_PROGRESS' },
    pointHistory: [],
    trusted: false,
    status: 'active',
    version: 25,
    createdAt: '2026-10-24T14:00:00.000Z',
    updatedAt: '2026-10-24T14:10:00.000Z',
    // A provider-scoring token: IONSport attests the scorer and that they are verified.
    crowdScoredBy: { personId: 'ionsport-scorer-1', displayName: 'IONSport', audience: 'provider', verified: true },
  };
}

test.describe('Journey 180 — crowd session: visible, then promoted to the live score', () => {
  let relay: FakeScoreRelay;

  test.beforeEach(async ({ page }) => {
    relay = await installFakeScoreRelay(page); // before goto — see the helper
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await pointScoreRelayAtApp(page);
  });

  test('the TD sees the session, promotes it, and follows its score', async ({ page }) => {
    const seed = await seedScheduledMatchUp(page, { tournamentId: TOURNAMENT_ID, date: DATE, nextDate: NEXT_DATE });
    const session = ionSportSession(seed.matchUpId);
    relay.sessions.push(session);
    // Opening the tournament ends with the /live subscription; navigate only after it (see journey 181).
    await expect.poll(() => relay.subscribedTo(), { timeout: 10_000 }).toBe(TOURNAMENT_ID);
    const drawRoute = `/#/tournament/${TOURNAMENT_ID}/event/${seed.eventId}/draw/${seed.drawId}`;
    await page.goto(drawRoute);

    // ── Bracket: the session is visible; its score is not yet trusted ──
    const cell = page.locator(`.tmx-m[id="${seed.matchUpId}"]`);
    const badge = cell.locator('.tmx-crowd-badge');
    const livePill = cell.getByText('LIVE', { exact: true });
    await expect(badge).toHaveText('1', { timeout: 10_000 });
    await expect(badge).not.toHaveClass(/tmx-crowd-badge--trusted/);
    await expect(livePill).toHaveCount(0);

    // ── The badge opens the dialog; Promote the verified provider-attested scorer ──
    await badge.click();
    const row = page.locator(`[data-testid="crowd-trackers-list"] [data-session-id="${SESSION_ID}"]`);
    await expect(row).toBeVisible();
    await expect(row).toContainText('VERIFIED');
    const promote = row.locator('button', { hasText: 'Promote' });
    await expect(promote).toBeEnabled();
    await promote.click();
    await expect(row.locator('button', { hasText: 'Demote' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    // ── Promoted: trusted badge, and the session's score is the live score ──
    const side1 = cell.locator('.tmx-sd[sideNumber="1"] .tmx-scr');
    const side2 = cell.locator('.tmx-sd[sideNumber="2"] .tmx-scr');
    await expect(badge).toHaveClass(/tmx-crowd-badge--trusted/);
    await expect(badge).toContainText('✓');
    await expect(livePill).toHaveCount(2);
    await expect(side1).toContainText('3');
    await expect(side2).toContainText('2');

    // ── The scorer plays on; the promoted feed is polled fast enough to follow ──
    session.currentScore = { sets: [{ setNumber: 1, side1Score: 4, side2Score: 2 }], matchUpStatus: 'IN_PROGRESS' };
    session.updatedAt = '2026-10-24T14:12:00.000Z';
    await expect(side1).toContainText('4', { timeout: 15_000 });

    // ── Schedule: grid cell + Now strip ──
    const tournamentPage = new TournamentPage(page);
    await tournamentPage.navigateToScheduling();
    const gridCell = page.locator(`[data-court-order] .spl-grid-cell[data-matchup-id="${seed.matchUpId}"]`);
    await expect(gridCell).toBeVisible({ timeout: 10_000 });
    await expect(gridCell.locator('.spl-grid-cell__score .tmx-crowd-badge--trusted')).toBeVisible();
    await expect(gridCell.locator('.spl-grid-cell__score .tmx-live-tag')).toHaveText('LIVE');
    await expect(gridCell).toContainText('4-2');
    const stripCell = page.locator('.spl-active-strip-cell', {
      has: page.locator(`.spl-grid-cell[data-matchup-id="${seed.matchUpId}"]`),
    });
    await expect(stripCell.locator('.spl-active-strip-state-pill')).toHaveText('LIVE');
    await expect(stripCell.locator('.tmx-crowd-badge--trusted')).toBeVisible();
  });
});
