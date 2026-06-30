/**
 * Journey 52 — Delegated-outcome reconciliation badge + Confirm menu item
 *
 * Crowd-sourced scoring, Phase D. When a completed matchUp still carries a
 * `delegatedOutcome` whose scorekeeper is NOT a tournament participant/official,
 * the Matches table flags it with a ⚠ reconciliation badge, and the matchUp's
 * three-dot menu offers "Confirm delegated outcome" (promote to official).
 *
 * Neither surface needs the score-relay: the delegated outcome is written
 * straight onto the matchUp via the factory `setDelegatedOutcome` method, and
 * the badge index is rebuilt when the Matches table renders. The relay-backed
 * surfaces (View crowd trackers / Set delegated outcome / nominate gating) are
 * covered in journey 53.
 *
 * Verifies:
 *   - the ⚠ badge renders for the flagged matchUp with the reconciliation tooltip,
 *   - the three-dot menu shows "Confirm delegated outcome",
 *   - and hides "Set delegated outcome" / "View crowd trackers" when there is
 *     no active crowd activity (crowdTrackerCount === 0).
 */
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { PROFILE_COMPLETED, seedTournament } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { test, expect } from '@playwright/test';

const CROWD_SCORER = { personId: 'e2e-crowd-scorer', displayName: 'Crowd Carl' };

test.describe('Journey 52 — delegated-outcome badge + Confirm menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('flagged matchUp shows the ⚠ badge and a Confirm-only crowd menu', async ({ page }) => {
    await seedTournament(page, PROFILE_COMPLETED);

    // Attach a delegated outcome from a non-participant ("crowd") scorer onto a
    // completed matchUp — the exact condition the reconciliation badge flags.
    const target = await page.evaluate((scorer) => {
      const { matchUps } = dev.tournamentEngine.allTournamentMatchUps();
      const mu = matchUps.find((m: any) => m.winningSide && m.drawId && m.matchUpId);
      if (!mu) return null;
      const result = dev.tournamentEngine.setDelegatedOutcome({
        matchUpId: mu.matchUpId,
        drawId: mu.drawId,
        outcome: {
          score: { sets: mu.score?.sets ?? [] },
          winningSide: mu.winningSide,
          scorer,
        },
      });
      return { matchUpId: mu.matchUpId, drawId: mu.drawId, success: !!result?.success };
    }, CROWD_SCORER);

    expect(target).not.toBeNull();
    expect(target!.success).toBe(true);

    const tournamentPage = new TournamentPage(page);
    await tournamentPage.navigateToMatchUps();
    await expect(tournamentPage.matchUpsTable).toBeVisible();

    // The reconciliation badge renders in the flagged matchUp's score cell.
    const badge = page.locator('.delegated-reconciliation-badge');
    await expect(badge.first()).toBeVisible();
    await expect(badge.first()).toHaveAttribute('title', /unconfirmed delegated score/i);

    // Open that matchUp's three-dot menu and assert the gated crowd actions.
    // The menu is a tippy created on-demand in Tabulator's cellClick: tipster
    // creates the instance and calls show() within the same click, so the first
    // click is consumed and the second reveals it. force:true because the icon
    // glyph is a small target in a 50px right-aligned cell.
    const row = page.locator('.tabulator-row', { has: page.locator('.delegated-reconciliation-badge') }).first();
    const threeDots = row.locator('.fa-ellipsis-vertical');
    await threeDots.click({ force: true });
    await threeDots.click({ force: true });

    const menu = page.locator('.tippy-content .menu-list');
    await expect(menu).toBeVisible();
    await expect(menu).toContainText('Confirm delegated outcome');
    // No active crowd sessions → these stay hidden.
    await expect(menu).not.toContainText('Set delegated outcome');
    await expect(menu).not.toContainText('View crowd trackers');
  });
});
