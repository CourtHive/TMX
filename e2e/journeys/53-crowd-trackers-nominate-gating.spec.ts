/**
 * Journey 53 — Crowd-trackers modal + nominate gating (relay-backed)
 *
 * Crowd-sourced scoring, Phase D. Active crowd-scoring sessions live on the
 * score-relay (never on CFS — Mentat Decision 6). TMX polls the relay into a
 * local activity index; when a matchUp has active sessions the three-dot menu
 * surfaces "View crowd trackers (N)" + "Set delegated outcome", and the modal
 * lets the TD nominate (promote) a scorer — but ONLY a known/verified identity.
 *
 * The relay is a separate origin in production; here it's pointed at the app
 * origin via `dev.setScoreRelayURL` and every `/api/crowd-sessions` request is
 * fulfilled from fixtures (no relay process, no CORS preflight). Verifies:
 *   - polling populates the index → the three-dot glow + "View crowd trackers"
 *     and "Set delegated outcome" menu items appear,
 *   - the modal lists each session with its classification + verified badges,
 *   - Promote is enabled for a verified crowd scorer (nominatable) and disabled
 *     with an explanatory tooltip for an unverified one (gating).
 */
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { PROFILE_COMPLETED, seedTournament } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { test, expect } from '@playwright/test';

const VERIFIED_SESSION = 'sess-verified';
const UNVERIFIED_SESSION = 'sess-unverified';

function buildSessions(matchUpId: string, tournamentId: string) {
  const base = {
    matchUpId,
    tournamentId,
    clientId: 'client-x',
    currentScore: { sets: [{ setNumber: 1, side1Score: 6, side2Score: 4 }] },
    pointHistory: [{}, {}, {}],
    trusted: false,
    status: 'active',
    version: 3,
    createdAt: '2026-06-30T10:00:00.000Z',
    updatedAt: '2026-06-30T10:05:00.000Z',
  };
  return [
    {
      ...base,
      sessionId: VERIFIED_SESSION,
      userId: 'user-verified',
      // Not a tournament participant → classified "crowd"; verified → nominatable.
      crowdScoredBy: { personId: 'crowd-verified-person', displayName: 'Vera Verified', audience: 'hiveid', verified: true },
    },
    {
      ...base,
      sessionId: UNVERIFIED_SESSION,
      userId: 'user-unverified',
      // Crowd + not email-verified → NOT nominatable (gated).
      crowdScoredBy: { personId: 'crowd-unverified-person', displayName: 'Uma Unverified', audience: 'hiveid', verified: false },
    },
  ];
}

test.describe('Journey 53 — crowd-trackers modal + nominate gating', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('relay sessions drive the menu + modal nominate gating', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_COMPLETED);

    // Pick a real played matchUp to attach the crowd sessions to.
    const matchUpId = await page.evaluate(() => {
      const { matchUps } = dev.tournamentEngine.allTournamentMatchUps();
      return matchUps.find((m: any) => m.winningSide && m.matchUpId)?.matchUpId as string;
    });
    expect(matchUpId).toBeTruthy();

    const sessions = buildSessions(matchUpId, tournamentId);

    // Fulfill every relay read (poller's tournament query + modal's matchUp
    // query) with the same fixture list; ack writes defensively.
    await page.route('**/api/crowd-sessions**', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sessions }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ session: sessions[0] }) });
      }
    });

    // Enable the relay client BEFORE the table builds (which starts the poller).
    await page.evaluate(() => dev.setScoreRelayURL('http://localhost:5173'));

    const tournamentPage = new TournamentPage(page);
    await tournamentPage.navigateToMatchUps();
    await expect(tournamentPage.matchUpsTable).toBeVisible();

    // Poller populated the activity index → the matchUp's three-dot glows.
    const glowingRow = page.locator('.tabulator-row', { has: page.locator('.three-dot-glow') }).first();
    await expect(glowingRow).toBeVisible({ timeout: 15_000 });

    // Open its three-dot menu (first click is consumed by tippy's on-demand
    // create+show; the second reveals it).
    const threeDots = glowingRow.locator('.fa-ellipsis-vertical');
    await threeDots.click({ force: true });
    await threeDots.click({ force: true });

    const menu = page.locator('.tippy-content .menu-list');
    await expect(menu).toBeVisible();
    // Active crowd activity → these are now offered (contrast journey 52).
    await expect(menu).toContainText('View crowd trackers');
    await expect(menu).toContainText('Set delegated outcome');

    // Open the crowd-trackers modal.
    await menu.locator('a', { hasText: 'View crowd trackers' }).click();

    const list = page.locator('[data-testid="crowd-trackers-list"]');
    await expect(list).toBeVisible();

    const verifiedRow = list.locator(`[data-session-id="${VERIFIED_SESSION}"]`);
    const unverifiedRow = list.locator(`[data-session-id="${UNVERIFIED_SESSION}"]`);
    await expect(verifiedRow).toBeVisible();
    await expect(unverifiedRow).toBeVisible();

    // Classification + verification badges.
    await expect(verifiedRow).toContainText('CROWD');
    await expect(verifiedRow).toContainText('VERIFIED');

    // Nominate gating: verified crowd scorer → Promote enabled; unverified → disabled + reason.
    const verifiedPromote = verifiedRow.locator('button', { hasText: 'Promote' });
    await expect(verifiedPromote).toBeEnabled();

    const unverifiedPromote = unverifiedRow.locator('button', { hasText: 'Promote' });
    await expect(unverifiedPromote).toBeDisabled();
    await expect(unverifiedPromote).toHaveAttribute('title', /not verified/i);
  });
});
