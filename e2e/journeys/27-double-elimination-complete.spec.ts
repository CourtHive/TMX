import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

const DE_PROFILE = {
  tournamentName: 'Double Elimination E2E',
  tournamentAttributes: { tournamentId: 'e2e-de-001' },
  participantsProfile: { scaledParticipantsCount: 32 },
  drawProfiles: [
    {
      eventName: 'DE Singles',
      drawSize: 32,
      seedsCount: 8,
      drawType: 'DOUBLE_ELIMINATION',
    },
  ],
};

test.describe('Double Elimination — complete all matchUps + topology viewer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('complete all matchUps preserves draw-level button bar', async ({ page }) => {
    const tournamentId = await seedTournament(page, DE_PROFILE);
    const tournament = new TournamentPage(page);

    await tournament.goto(tournamentId);
    await tournament.navigateToEvents();

    // Click into the event to render its draw
    await page.locator(`${S.EVENTS_TABLE} .tabulator-row`).first().click();
    await expect(page.locator(S.DRAW_FRAME)).toBeVisible({ timeout: 10_000 });

    // Verify the draw-level control bar is showing (has icon buttons on RIGHT)
    const eventControl = page.locator(S.EVENT_CONTROL);
    await expect(eventControl).toBeVisible();

    // The complete-all button (fa-check-double icon) should be present
    const completeBtn = eventControl.locator('i.fa-check-double');
    await expect(completeBtn).toBeVisible({ timeout: 5_000 });

    // The topology button (fa-sitemap icon) should be present (DE has multiple structures)
    const topologyBtn = eventControl.locator('i.fa-sitemap');
    await expect(topologyBtn).toBeVisible({ timeout: 5_000 });

    // Click complete all matchUps via the dev bridge (same as the UI button)
    // Using dev bridge avoids needing to wait for multi-pass async callbacks
    await page.evaluate(() => (globalThis as any).dev.completeMatchUps());

    // Wait for the re-render to settle — the draw view should be restored
    // after the setTimeout(0) fix in reRenderCurrentView
    await expect(page.locator(S.DRAW_FRAME)).toBeVisible({ timeout: 15_000 });

    // The draw-level EVENT_CONTROL should still be visible with icon buttons
    await expect(eventControl).toBeVisible();

    // The topology icon should still be present (draw-level bar, not event-level)
    await expect(topologyBtn).toBeVisible({ timeout: 5_000 });

    // The event-level buttons (Add draw, Add flights) should NOT be showing
    // They belong to the entries/draws-table view, not the draw view
    const addDrawBtn = eventControl.getByRole('button', { name: 'Add draw' });
    await expect(addDrawBtn).toHaveCount(0);

    const addFlightsBtn = eventControl.getByRole('button', { name: 'Add flights' });
    await expect(addFlightsBtn).toHaveCount(0);
  });

  test('topology viewer renders without crashing on Double Elimination', async ({ page }) => {
    const tournamentId = await seedTournament(page, DE_PROFILE);
    const tournament = new TournamentPage(page);

    await tournament.goto(tournamentId);
    await tournament.navigateToEvents();

    // Click into the event to render its draw
    await page.locator(`${S.EVENTS_TABLE} .tabulator-row`).first().click();
    await expect(page.locator(S.DRAW_FRAME)).toBeVisible({ timeout: 10_000 });

    // Click the topology icon button
    const eventControl = page.locator(S.EVENT_CONTROL);
    const topologyBtn = eventControl.locator('i.fa-sitemap');
    await expect(topologyBtn).toBeVisible({ timeout: 5_000 });
    await topologyBtn.click();

    // The topology canvas should render within DRAWS_VIEW
    const drawsView = page.locator(S.DRAWS_VIEW);
    await expect(drawsView).toBeVisible({ timeout: 5_000 });

    // The topology builder canvas should be present
    const canvas = drawsView.locator('.tb-canvas');
    await expect(canvas).toBeVisible({ timeout: 5_000 });

    // Double Elimination has 3 structures (Main, Backdraw, Decider) — verify 3 cards
    const cards = canvas.locator('.tb-card');
    await expect(cards).toHaveCount(3, { timeout: 5_000 });

    // Each card should contain a schematic preview or fallback text
    for (let i = 0; i < 3; i++) {
      const card = cards.nth(i);
      await expect(card).toBeVisible();
      const preview = card.locator('.tb-card-preview');
      await expect(preview).toBeVisible();
    }

    // SVG edges should be rendered between the structure cards
    const svgEdges = canvas.locator('svg path:not(.tb-edge-hit)');
    // DE has multiple links: loser links (main→consolation), finalist link, decider links
    const edgeCount = await svgEdges.count();
    expect(edgeCount).toBeGreaterThanOrEqual(3);

    // The "View Draw" button should be present in the control bar (topology mode)
    const viewDrawBtn = eventControl.getByRole('button', { name: /view draw/i });
    await expect(viewDrawBtn).toBeVisible({ timeout: 5_000 });
  });
});
