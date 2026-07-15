/**
 * Journey 85 — Composite draw structures (RR + elimination) in the draws views
 *
 * Two regressions when a draw combines round-robin and single-elimination:
 *
 *  1. Draws TABLE "Draw type" column read just "SINGLE_ELIMINATION" for a draw
 *     that is really a round-robin QUALIFYING feeding a single-elimination MAIN
 *     (drawDefinition.drawType names only the MAIN structure). It must now read
 *     "Single Elimination (Round Robin Qualifying)".
 *
 *  2. Draws GRID progression sunburst rendered `structures[0]` as a single-
 *     elimination bracket. For composite draws that grabbed the round-robin
 *     structure and force-fit its non-halving rounds into an SE bracket, lumping
 *     in every RR matchUp unconnected. The sunburst must render the ELIMINATION
 *     structure (MAIN SE, or the playoff) and render NOTHING for a pure
 *     round-robin draw (no bracket exists).
 */
import { test, expect } from '@playwright/test';
import {
  ensureDrawsGridMode,
  ensureDrawsTableMode,
  initDevBridge,
  resetDrawsViewState,
  resetEventsViewMode,
  resetState,
  waitForAppReady,
} from '../helpers/dev-bridge';
import { seedTournament } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';

const DRAW_CARD = '.chc-dc-card';
const VIZ_ZONE = '.chc-dc-viz';

// One event, two SE draws — one with a round-robin QUALIFYING stage feeding the
// SE main (qualifyingPositions reserves the main slots so it seeds cleanly).
const PROFILE_QUALIFYING_RR = {
  tournamentName: 'E2E Composite Draws',
  tournamentAttributes: { tournamentId: 'e2e-composite-draws' },
  participantsProfile: { participantsCount: 80 },
  eventProfiles: [
    {
      eventName: 'Singles',
      drawProfiles: [
        {
          drawName: 'Championship',
          drawType: 'SINGLE_ELIMINATION' as const,
          drawSize: 16,
          qualifyingPositions: 4,
          qualifyingProfiles: [
            { structureProfiles: [{ stageSequence: 1, drawType: 'ROUND_ROBIN', drawSize: 8, qualifyingPositions: 4 }] },
          ],
        },
        { drawName: 'Plate', drawType: 'SINGLE_ELIMINATION' as const, drawSize: 16 },
      ],
    },
  ],
  completeAllMatchUps: true,
};

// One event, three draws: pure round-robin (no bracket), plain SE, and
// round-robin-with-playoff (RR groups → elimination playoff).
const PROFILE_MIXED_STRUCTURES = {
  tournamentName: 'E2E Mixed Draws',
  tournamentAttributes: { tournamentId: 'e2e-mixed-draws' },
  participantsProfile: { participantsCount: 80 },
  eventProfiles: [
    {
      eventName: 'Singles',
      drawProfiles: [
        { drawName: 'Round Robin Pool', drawType: 'ROUND_ROBIN' as const, drawSize: 8 },
        { drawName: 'Knockout', drawType: 'SINGLE_ELIMINATION' as const, drawSize: 16 },
        { drawName: 'Groups To Final', drawType: 'ROUND_ROBIN_WITH_PLAYOFF' as const, drawSize: 8 },
      ],
    },
  ],
  completeAllMatchUps: true,
};

async function eventIdOf(page: import('@playwright/test').Page): Promise<string> {
  const eventId = await page.evaluate(() => {
    const { tournamentRecord } = dev.factory.tournamentEngine.getTournament();
    return tournamentRecord?.events?.[0]?.eventId as string | undefined;
  });
  expect(eventId).toBeTruthy();
  return eventId as string;
}

async function pickSunburst(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('button[aria-label="Card display options"]').click();
  await page.locator('input[name="drawCardDisplay"]').first().waitFor({ state: 'visible', timeout: 5_000 });
  await page.locator('input[name="drawCardDisplay"][value="sunburst"]').click();
}

test.describe('Journey 85 — Composite draw structures', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await resetEventsViewMode(page);
    await resetDrawsViewState(page);
  });

  test('draws table Draw-type column surfaces a round-robin qualifying', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_QUALIFYING_RR);
    await new TournamentPage(page).goto(tournamentId);
    await ensureDrawsTableMode(page);
    const eventId = await eventIdOf(page);
    await page.goto(`/#/tournament/${tournamentId}/event/${eventId}/draws`);
    await page.locator('.tabulator-row').first().waitFor({ state: 'visible', timeout: 10_000 });

    const drawTypeOfRow = (drawName: string) =>
      page
        .locator('.tabulator-row', { hasText: drawName })
        .locator('[tabulator-field="drawType"]')
        .innerText();

    // Regression: this row used to read just "SINGLE_ELIMINATION".
    expect((await drawTypeOfRow('Championship')).trim()).toBe('Single Elimination (Round Robin Qualifying)');
    // A plain SE draw is unchanged (now title-cased).
    expect((await drawTypeOfRow('Plate')).trim()).toBe('Single Elimination');
  });

  test('sunburst renders elimination brackets but not pure round-robin draws', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_MIXED_STRUCTURES);
    await new TournamentPage(page).goto(tournamentId);
    await ensureDrawsGridMode(page);
    const eventId = await eventIdOf(page);
    await page.goto(`/#/tournament/${tournamentId}/event/${eventId}/draws`);
    await page.locator(DRAW_CARD).first().waitFor({ state: 'visible', timeout: 10_000 });
    await expect(page.locator(DRAW_CARD)).toHaveCount(3);

    await pickSunburst(page);

    // Elimination bracket (SE) and the RR-with-playoff (its PLAY_OFF bracket)
    // render; the pure round-robin draw has no bracket → no viz. Pre-fix all
    // three rendered (the RR structures force-fit into an SE bracket).
    await expect(page.locator(VIZ_ZONE)).toHaveCount(2);

    const cardByName = (name: string) => page.locator(DRAW_CARD).filter({ hasText: name });
    await expect(cardByName('Round Robin Pool').locator(VIZ_ZONE)).toHaveCount(0);
    await expect(cardByName('Knockout').locator(`${VIZ_ZONE} svg`)).toHaveCount(1);
    await expect(cardByName('Groups To Final').locator(`${VIZ_ZONE} svg`)).toHaveCount(1);
  });
});
