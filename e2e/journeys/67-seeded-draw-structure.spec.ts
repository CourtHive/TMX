import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/**
 * Journey 67 — Seeded-draw structural correctness (seed placement + BYE geometry).
 *
 * The 02–16 draw-form specs verify the form *inputs*; nothing asserts the
 * resulting bracket *geometry* — the factory→UI contract most prone to silent
 * regression (mis-seeded draws, BYE-adjacent advancement bugs). This seeds a
 * 32-bracket SE with 24 players (→ 8 BYEs) and 8 seeds, then asserts the
 * generated structure TMX loads has correct seed placement and BYE geometry,
 * and that TMX renders the seeded bracket.
 *
 * Assertions are structural invariants (deterministic under standard seeding),
 * not exact non-top-seed positions (policy-dependent).
 */

const DRAW_SIZE = 32;
const PLAYER_COUNT = 24; // → 8 BYEs
const SEEDS = 8;

interface StructureProbe {
  positionCount: number;
  byeCount: number;
  playerCount: number;
  doubleByeMatchUps: number;
  round1MatchUpCount: number;
  round1ByeMatchUps: number;
  seed1Position: number | null;
  seed2Position: number | null;
  seed1MatchUpStatus: string | null;
}

async function probeStructure(page: import('@playwright/test').Page): Promise<StructureProbe> {
  return page.evaluate(() => {
    const tournament = dev.getTournament();
    const structures = tournament.events?.[0]?.drawDefinitions?.[0]?.structures ?? [];
    const main = structures.find((s: any) => s.stage === 'MAIN');
    const positionAssignments: any[] = main?.positionAssignments ?? [];
    const seedAssignments: any[] = main?.seedAssignments ?? [];

    const posByDrawPosition = new Map<number, any>();
    for (const pa of positionAssignments) posByDrawPosition.set(pa.drawPosition, pa);

    const seedParticipant = (seedNumber: number): string | undefined =>
      seedAssignments.find((s: any) => s.seedNumber === seedNumber)?.participantId;

    const drawPositionOf = (participantId?: string): number | null => {
      if (!participantId) return null;
      const pa = positionAssignments.find((p: any) => p.participantId === participantId);
      return pa?.drawPosition ?? null;
    };

    const seed1Id = seedParticipant(1);
    const seed2Id = seedParticipant(2);

    const matchUps: any[] = dev.factory.tournamentEngine.allTournamentMatchUps({ inContext: true }).matchUps ?? [];
    const round1Main = matchUps.filter((m: any) => m.stage === 'MAIN' && m.roundNumber === 1);

    const isByeSide = (side: any): boolean => !!side?.bye || (!side?.participantId && !side?.participant);
    const doubleByeMatchUps = round1Main.filter(
      (m: any) => (m.sides ?? []).length === 2 && (m.sides ?? []).every(isByeSide),
    ).length;

    const seed1MatchUp = round1Main.find((m: any) =>
      (m.sides ?? []).some((side: any) => side?.participantId === seed1Id || side?.participant?.participantId === seed1Id),
    );

    return {
      positionCount: positionAssignments.length,
      byeCount: positionAssignments.filter((p: any) => p.bye).length,
      playerCount: positionAssignments.filter((p: any) => p.participantId).length,
      doubleByeMatchUps,
      round1MatchUpCount: round1Main.length,
      round1ByeMatchUps: round1Main.filter((m: any) => m.matchUpStatus === 'BYE').length,
      seed1Position: drawPositionOf(seed1Id),
      seed2Position: drawPositionOf(seed2Id),
      seed1MatchUpStatus: seed1MatchUp?.matchUpStatus ?? null,
    } as StructureProbe;
  });
}

test.describe('Journey 67 — seeded-draw structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('seed placement + BYE geometry are correct, and TMX renders the bracket', async ({ page }) => {
    const tournamentId = await seedTournament(page, {
      tournamentName: 'E2E Seeded Draw Structure',
      tournamentAttributes: { tournamentId: 'e2e-seeded-draw-structure' },
      // participantsCount < drawSize forces BYEs (the whole point of this test);
      // scaledParticipantsCount only sizes the pool, not the draw entries.
      drawProfiles: [
        { eventName: 'Singles', drawSize: DRAW_SIZE, participantsCount: PLAYER_COUNT, seedsCount: SEEDS, drawType: 'SINGLE_ELIMINATION' },
      ],
    });

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);

    const probe = await probeStructure(page);

    // Bracket size + BYE accounting.
    expect(probe.positionCount).toBe(DRAW_SIZE);
    expect(probe.playerCount).toBe(PLAYER_COUNT);
    expect(probe.byeCount).toBe(DRAW_SIZE - PLAYER_COUNT); // 8
    expect(probe.round1MatchUpCount).toBe(DRAW_SIZE / 2); // 16
    expect(probe.round1ByeMatchUps).toBe(DRAW_SIZE - PLAYER_COUNT); // one BYE matchUp per bye

    // No matchUp is BYE-vs-BYE (the DOUBLE_BYE class the factory must never emit).
    expect(probe.doubleByeMatchUps).toBe(0);

    // Standard seeding invariants: seed 1 at drawPosition 1; seed 1 and seed 2
    // in opposite halves; the top seed receives a first-round BYE.
    expect(probe.seed1Position).toBe(1);
    expect(probe.seed1Position!).toBeLessThanOrEqual(DRAW_SIZE / 2);
    expect(probe.seed2Position!).toBeGreaterThan(DRAW_SIZE / 2);
    expect(probe.seed1MatchUpStatus).toBe('BYE');

    // TMX renders the seeded bracket without error.
    await tournament.navigateToEvents();
    await page.locator(`${S.EVENTS_TABLE} .tabulator-row`).first().click();
    await expect(page.locator(S.DRAW_FRAME)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(S.DRAWS_VIEW)).toBeVisible({ timeout: 5_000 });
  });
});
