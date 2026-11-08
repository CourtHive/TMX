import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament } from '../helpers/seed';

declare const dev: any;

/**
 * Following a participant across structures (CA, 2026-11-08): from their place in one structure to their place in
 * another, and their whole path in the topology's Player journey mode — which shows no names; its search takes one.
 */
test.describe('Topology — Player journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('a main-draw loser fed into the consolation: go there, and see the whole journey', async ({ page }) => {
    const tournamentId = await seedTournament(page, {
      tournamentAttributes: { tournamentId: 'e2e-topology-journey-001' },
      drawProfiles: [{ drawSize: 16, drawType: 'FEED_IN_CHAMPIONSHIP' }],
      completeAllMatchUps: true,
    });

    // a participant who lost in the main draw's first round and played on in the consolation
    const traveller = await page.evaluate(() => {
      const event = dev.getTournament().events[0];
      const drawDefinition = event.drawDefinitions[0];
      const [main, consolation] = drawDefinition.structures;
      const { matchUps } = dev.factory.tournamentEngine.allTournamentMatchUps({
        matchUpFilters: { drawIds: [drawDefinition.drawId] },
        inContext: true,
      });
      const r1 = matchUps.filter((m: any) => m.structureId === main.structureId && m.roundNumber === 1);
      const loser = r1
        .map((m: any) => m.sides.find((s: any) => s.sideNumber !== m.winningSide))
        .find((side: any) =>
          matchUps.some(
            (m: any) =>
              m.structureId === consolation.structureId &&
              m.sides?.some((s: any) => s.participantId === side.participantId),
          ),
        );
      const consolationRounds = matchUps
        .filter(
          (m: any) =>
            m.structureId === consolation.structureId &&
            m.sides?.some((s: any) => s.participantId === loser.participantId),
        )
        .map((m: any) => m.roundNumber);
      return {
        eventId: event.eventId,
        drawId: drawDefinition.drawId,
        participantId: loser.participantId,
        name: loser.participant.participantName,
        furthestConsolationRound: Math.max(...consolationRounds),
      };
    });

    await page.goto(`/#/tournament/${tournamentId}/event/${traveller.eventId}/draw/${traveller.drawId}`);
    const inMain = page.locator('.tmx-rd[roundNumber="1"]').locator(`.tmx-i[id="${traveller.participantId}"]`).first();
    await expect(inMain).toBeVisible({ timeout: 10_000 });
    await inMain.click();

    // the menu names where they went, and the round
    const menu = page.locator('.tippy-content');
    await expect(menu.getByText(`Go to Consolation — round ${traveller.furthestConsolationRound}`)).toBeVisible();
    await expect(menu.getByText('See player journey')).toBeVisible();
    await menu.getByText('See player journey').click();

    // the topology, in journey mode, on the traveller: both structures lit, the link they took, no name on the canvas
    const canvas = page.locator('.tb-canvas');
    await expect(page.locator('button.tb-mode-toggle[data-mode="journey"]')).toHaveAttribute('aria-pressed', 'true', {
      timeout: 10_000,
    });
    await expect(canvas.locator('.tb-card--on-journey')).toHaveCount(2);
    await expect(canvas.locator('path.tb-edge--journey')).toHaveCount(1);
    const summary = page.locator('.tb-footer-hint');
    await expect(summary).toContainText('Main R1 L → Consolation');
    await expect(canvas).not.toContainText(traveller.name);
    await expect(summary).not.toContainText(traveller.name);

    // the search finds them by name
    await page.locator('.tb-journey-input').fill(traveller.name.slice(0, 4));
    await expect(page.locator(`.tb-journey-result[data-participant-id="${traveller.participantId}"]`)).toHaveText(
      traveller.name,
    );

    // a lit consolation round goes to that matchUp in the draw
    await canvas
      .locator('.tb-card--on-journey')
      .filter({ has: page.locator('.tb-card-name', { hasText: 'Consolation' }) })
      .locator('.tb-round-journey')
      .first()
      .click();
    await expect(page.locator('.tb-canvas')).toHaveCount(0, { timeout: 10_000 });
  });
});
