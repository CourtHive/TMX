import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, PROFILE_DRAW_GENERATED } from '../helpers/seed';
import { enterScore } from '../helpers/enterScore';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 66 — Score entry → winner advances.
 *
 * The scoring MODAL is covered in courthive-components; TMX e2e uses the single
 * `enterScore` helper (setMatchUpStatus with allowChangePropagation, via the real
 * dev.mutationRequest path) to set up scored state and test TMX topics that
 * depend on it. Here: completing a round-1 matchUp propagates the winner into
 * round 2, and the matchUps table renders the completed matchUp.
 */

async function firstRound1(page: Page): Promise<{ matchUpId: string; drawId: string; side1ParticipantId: string }> {
  return page.evaluate(() => {
    const matchUps = dev.factory.tournamentEngine.allTournamentMatchUps({ inContext: true }).matchUps || [];
    const m = matchUps.find(
      (x: any) =>
        x.roundNumber === 1 &&
        x.matchUpStatus !== 'BYE' &&
        (x.sides || []).filter((s: any) => s.participantId || s.participant?.participantId).length === 2,
    );
    const side1 = (m.sides || []).find((s: any) => s.sideNumber === 1) || m.sides[0];
    return {
      matchUpId: m.matchUpId as string,
      drawId: m.drawId as string,
      side1ParticipantId: (side1.participantId ?? side1.participant?.participantId) as string,
    };
  });
}

test.describe('Journey 66 — score entry advances the winner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('completing a round-1 matchUp propagates the winner into round 2', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_DRAW_GENERATED);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);

    const r1 = await firstRound1(page);

    await enterScore(page, {
      matchUpId: r1.matchUpId,
      drawId: r1.drawId,
      scoreString: '6-2 6-3',
      winningSide: 1,
    });

    // The R1 matchUp is completed with the expected winner, and that participant
    // now populates a round-2 side (advancement / change propagation).
    const result = await page.evaluate(
      ({ matchUpId, winnerId }) => {
        const matchUps = dev.factory.tournamentEngine.allTournamentMatchUps({ inContext: true }).matchUps || [];
        const scored = matchUps.find((m: any) => m.matchUpId === matchUpId);
        const winnerInR2 = matchUps.some(
          (m: any) =>
            m.roundNumber === 2 &&
            (m.sides || []).some((s: any) => (s.participantId ?? s.participant?.participantId) === winnerId),
        );
        return { status: scored?.matchUpStatus, winningSide: scored?.winningSide, winnerInR2 };
      },
      { matchUpId: r1.matchUpId, winnerId: r1.side1ParticipantId },
    );

    expect(result.status).toBe('COMPLETED');
    expect(result.winningSide).toBe(1);
    expect(result.winnerInR2).toBe(true);

    // TMX renders the completed matchUp in the matchUps table.
    await tournament.navigateToMatchUps();
    await expect(page.locator('#tournamentMatchUps .tabulator-row').first()).toBeVisible({ timeout: 10_000 });
  });
});
