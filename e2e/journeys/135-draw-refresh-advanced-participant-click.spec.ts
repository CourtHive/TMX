import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { enterScore } from '../helpers/enterScore';
import { seedTournament } from '../helpers/seed';
import { test, expect } from '@playwright/test';

/**
 * Journey 135 — a participant advanced by a score is clickable without a page refresh.
 *
 * Scoring a matchUp refreshes the draw in place, and two things kept answering from the render
 * BEFORE the score:
 *   - morphdom copies attributes and children onto the nodes already in the page, never the `onclick`
 *     PROPERTY, so the round-2 slot that had been TBD kept a closure bound to its empty side;
 *   - the draw's event handlers looked matchUps up in the eventData captured at first render.
 * Together they made the advanced winner offer no menu at all until a reload. Either fix alone turns
 * this journey green; both are kept, because each also feeds other handlers stale data.
 */

test.describe('Journey 135 — advanced participant click after an in-place refresh', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('the winner advanced into round 2 offers the player card without a reload', async ({ page }) => {
    const tournamentId = await seedTournament(page, {
      tournamentAttributes: { tournamentId: 'e2e-advanced-participant-click' },
      drawProfiles: [{ drawSize: 8 }],
    });
    const ids = await page.evaluate(() => {
      const event = dev.getTournament().events[0];
      return { eventId: event.eventId, drawId: event.drawDefinitions[0].drawId };
    });
    await page.goto(`/#/tournament/${tournamentId}/event/${ids.eventId}/draw/${ids.drawId}`);

    const r1 = await page.evaluate(() => {
      const { matchUps } = dev.factory.tournamentEngine.allTournamentMatchUps({
        matchUpFilters: { roundNumbers: [1] },
        inContext: true,
      });
      const matchUp = matchUps.find((m: any) => m.roundPosition === 1);
      const side1 = matchUp.sides.find((s: any) => s.sideNumber === 1);
      return { matchUpId: matchUp.matchUpId, drawId: matchUp.drawId, winnerId: side1.participantId };
    });

    // Rendered BEFORE the score: round 2 holds no one yet.
    const round2 = page.locator('.tmx-rd[roundNumber="2"]');
    await expect(round2.locator(`.tmx-i[id="${r1.winnerId}"]`)).toHaveCount(0);

    await enterScore(page, { ...r1, scoreString: '6-1 6-1', winningSide: 1, refreshActive: true });

    const advanced = round2.locator(`.tmx-i[id="${r1.winnerId}"]`);
    await expect(advanced).toHaveCount(1);
    await advanced.click();

    await expect(page.locator('.tippy-content').getByText('View player card')).toBeVisible();
  });
});
