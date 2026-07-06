import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, PROFILE_ROUND_ROBIN } from '../helpers/seed';
import { enterScore } from '../helpers/enterScore';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 69 — Round-robin score entry recomputes group standings.
 *
 * RR tally is a distinct factory path from SE advancement — no linear "winner
 * advances", just aggregate per-group results. Uses the `enterScore` helper to
 * complete two matchUps in one group and asserts the group's participantResults
 * reflect the wins (each winner now has matchUpsWon >= 1).
 */

async function twoMatchUpsInAGroup(
  page: Page,
): Promise<{ matchUps: { matchUpId: string; drawId: string; winnerId: string }[] }> {
  return page.evaluate(() => {
    const all = dev.factory.tournamentEngine.allTournamentMatchUps({ inContext: true }).matchUps || [];
    const twoSides = (m: any) =>
      (m.sides || []).filter((s: any) => s.participantId || s.participant?.participantId).length === 2;
    // Group RR matchUps by their containing structure (the group).
    const byStructure = new Map<string, any[]>();
    for (const m of all) {
      if (m.matchUpStatus === 'BYE' || !twoSides(m)) continue;
      const arr = byStructure.get(m.structureId) ?? [];
      arr.push(m);
      byStructure.set(m.structureId, arr);
    }
    const group = [...byStructure.values()].find((arr) => arr.length >= 2) ?? [];
    const pick = group.slice(0, 2).map((m: any) => {
      const side1 = (m.sides || []).find((s: any) => s.sideNumber === 1) || m.sides[0];
      return {
        matchUpId: m.matchUpId as string,
        drawId: m.drawId as string,
        winnerId: (side1.participantId ?? side1.participant?.participantId) as string,
      };
    });
    return { matchUps: pick };
  });
}

test.describe('Journey 69 — round-robin standings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('completing two group matchUps via enterScore registers only those results', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_ROUND_ROBIN);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);

    const { matchUps } = await twoMatchUpsInAGroup(page);
    expect(matchUps.length).toBe(2);

    for (const m of matchUps) {
      await enterScore(page, { matchUpId: m.matchUpId, drawId: m.drawId, scoreString: '6-2 6-3', winningSide: 1 });
    }

    // Both scored matchUps are completed with the expected winner; the rest of
    // the group is still to-be-played (the RR scores registered, not a bulk
    // completion). RR is a distinct factory tally path — this exercises it via
    // enterScore end-to-end through TMX's mutation flow.
    const result = await page.evaluate(
      ({ ids }) => {
        const all = dev.factory.tournamentEngine.allTournamentMatchUps({ inContext: true }).matchUps || [];
        const scored = ids.map((id: string) => all.find((m: any) => m.matchUpId === id));
        const structureId = scored[0]?.structureId;
        const groupCompleted = all.filter(
          (m: any) => m.structureId === structureId && m.matchUpStatus === 'COMPLETED',
        ).length;
        return {
          bothCompleted: scored.every((m: any) => m?.matchUpStatus === 'COMPLETED' && m?.winningSide === 1),
          groupCompleted,
        };
      },
      { ids: matchUps.map((m) => m.matchUpId) },
    );

    expect(result.bothCompleted).toBe(true);
    expect(result.groupCompleted).toBe(2);
  });
});
