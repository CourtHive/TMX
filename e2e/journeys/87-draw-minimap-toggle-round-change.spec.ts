/**
 * Journey 87 — Bracket minimap toggle survives in-view round changes
 *
 * Regression guard for the fix in renderDrawView.ts (onInitialRoundChange now
 * re-runs drawControlBar). The minimap toggle icon is only eligible on the
 * first round (R1) of a large SINGLE_ELIMINATION structure. Two paths broke
 * before the fix:
 *
 *   1. Primary — landing on a non-first round (clicking a semifinal matchUp in
 *      the matchUps view stashes a pending focus that lands the draw view on
 *      the SF round) never injected the toggle, and switching to R1 in-view
 *      rendered the minimap body but STILL no toggle icon (only a full
 *      navigate-away-and-back would surface it).
 *
 *   2. Symmetric — starting on R1 (toggle present) then switching to SF in-view
 *      left a STALE toggle icon behind, since the control bar was never rebuilt.
 *
 * Both directions are asserted here. The toggle is #drawMinimapToggle in the
 * draw control bar; the minimap navigator is .chc-minimap in #drawsView.
 */
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { test, expect, type Page } from '@playwright/test';
import { S } from '../helpers/selectors';

// drawSize 32 = 5 rounds (R32, R16, QF, SF, F) — the minimap eligibility floor
// is roundCount >= 5, so this is the smallest SE draw that offers the toggle.
const SE_32_PROFILE: MockProfile = {
  tournamentName: 'E2E Minimap Round Change',
  tournamentAttributes: { tournamentId: 'e2e-minimap-round-change' },
  participantsProfile: { scaledParticipantsCount: 32 },
  drawProfiles: [{ eventName: 'Singles', drawSize: 32, drawType: 'SINGLE_ELIMINATION' }],
  completeAllMatchUps: true,
};

const MINIMAP = '.chc-minimap';
const TOGGLE = '#drawMinimapToggle';

// A round-selector tab (R1 / R2 / QF / SF / F) inside the draw control bar.
// The label text is unique to the round tabs — the view tabs (Bracket / Table /
// …) never collide with these — so anchoring on the exact label is safe.
const roundTab = (page: Page, label: string) =>
  page.locator(`${S.DRAW_CONTROL} .tabs a`, { hasText: new RegExp(`^${label}$`) });

/**
 * Navigate to the matchUps view and click a semifinal matchUp's event pill.
 * The matchUps table is height-virtualized (index: matchUpId), so the SF row
 * may not be mounted — scroll it into view via its Tabulator instance first,
 * then click the real pill so navigateToEvent stashes the pending focus exactly
 * as production does. Lands the draw view on the SF round.
 */
async function openDrawOnSemifinal(page: Page): Promise<void> {
  const { roundName } = await page.evaluate(() => {
    const { matchUps } = dev.factory.tournamentEngine.allTournamentMatchUps();
    const played = (matchUps ?? []).filter((m: any) => m.roundNumber && m.matchUpStatus !== 'BYE');
    const maxRound = Math.max(...played.map((m: any) => m.roundNumber));
    const semi = played.find((m: any) => m.roundNumber === maxRound - 1);
    const tables = dev.tournamentContext?.tables ?? {};
    for (const key of Object.keys(tables)) {
      try {
        if (tables[key]?.getRow?.(semi?.matchUpId)) {
          tables[key].scrollToRow(semi.matchUpId, 'center', false);
          break;
        }
      } catch {
        /* not the matchUps table — keep scanning */
      }
    }
    return { roundName: semi?.roundName as string };
  });

  const sfRow = page
    .locator('.tabulator-row', {
      has: page.locator('[tabulator-field="roundName"]', { hasText: new RegExp(`^${roundName}$`) }),
    })
    .first();
  await sfRow.locator('.event-pill').first().click();
  await expect(page.locator(S.DRAW_CONTROL)).toBeVisible({ timeout: 10_000 });
}

async function openDrawOnFirstRound(page: Page, tournament: TournamentPage): Promise<void> {
  await tournament.navigateToEvents();
  await page.locator(`${S.EVENTS_TABLE} .tabulator-row`).first().click();
  await expect(page.locator(S.DRAW_FRAME)).toBeVisible({ timeout: 10_000 });
}

test.describe('Journey 87 — Minimap toggle survives in-view round changes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('landing on a semifinal then switching to R1 in-view reveals the toggle', async ({ page }) => {
    const tournamentId = await seedTournament(page, SE_32_PROFILE);
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToMatchUps();
    await expect(page.locator(S.MATCHUPS_CONTROL)).toBeVisible();

    // Land on the SF round via a matchUp click — non-first round, so no toggle
    // and no minimap.
    await openDrawOnSemifinal(page);
    await expect(roundTab(page, 'R1')).toBeVisible();
    await expect(page.locator(TOGGLE)).toHaveCount(0);
    await expect(page.locator(MINIMAP)).toHaveCount(0);

    // Switch to R1 in-view: the regression is that the toggle stayed absent.
    await roundTab(page, 'R1').click();
    await expect(page.locator(TOGGLE)).toBeVisible({ timeout: 5_000 });
    await expect(page.locator(TOGGLE)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(MINIMAP)).toBeVisible();
  });

  test('starting on R1 then switching to SF in-view removes the stale toggle', async ({ page }) => {
    const tournamentId = await seedTournament(page, SE_32_PROFILE);
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);

    // Fresh draw view lands on R1 — toggle + minimap present.
    await openDrawOnFirstRound(page, tournament);
    await expect(page.locator(TOGGLE)).toBeVisible();
    await expect(page.locator(MINIMAP)).toBeVisible();

    // Switch to SF: the regression is that the toggle lingered on a non-first
    // round. It must be removed (with its minimap).
    await roundTab(page, 'SF').click();
    await expect(page.locator(TOGGLE)).toHaveCount(0, { timeout: 5_000 });
    await expect(page.locator(MINIMAP)).toHaveCount(0);

    // And back to R1 re-adds it.
    await roundTab(page, 'R1').click();
    await expect(page.locator(TOGGLE)).toBeVisible({ timeout: 5_000 });
    await expect(page.locator(MINIMAP)).toBeVisible();
  });
});
