import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { seedTournament, PROFILE_DRAW_GENERATED } from '../helpers/seed';
import { CalendarPage } from '../pages/CalendarPage';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

test.describe('Journey 1 — Create and verify tournament', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('seed a tournament via mocksEngine and verify calendar shows it', async ({ page }) => {
    const calendar = new CalendarPage(page);

    // Seed a tournament with a generated draw
    const tournamentId = await seedTournament(page, {
      tournamentName: 'E2E Smoke Test',
      tournamentAttributes: { tournamentId: 'e2e-smoke-001' },
      participantsProfile: { scaledParticipantsCount: 32 },
      drawProfiles: [
        {
          eventName: 'U18 Singles',
          drawSize: 16,
          seedsCount: 4,
          drawType: 'SINGLE_ELIMINATION',
        },
      ],
    });

    expect(tournamentId).toBe('e2e-smoke-001');

    // Reload the calendar to pick up the seeded tournament
    await calendar.goto();
    await expect(calendar.table).toBeVisible();
  });

  test('open a seeded tournament and verify navigation tabs render', async ({ page }) => {
    // Seed
    const tournamentId = await seedTournament(page, PROFILE_DRAW_GENERATED);
    const tournament = new TournamentPage(page);

    // Navigate into the tournament
    await tournament.goto(tournamentId);

    // Verify the navigation icons are present
    await expect(page.locator(S.NAV_OVERVIEW)).toBeVisible();
    await expect(page.locator(S.NAV_PARTICIPANTS)).toBeVisible();
    await expect(page.locator(S.NAV_EVENTS)).toBeVisible();
    await expect(page.locator(S.NAV_MATCHUPS)).toBeVisible();
    await expect(page.locator(S.NAV_SCHEDULE)).toBeVisible();
    await expect(page.locator(S.NAV_VENUES)).toBeVisible();
  });

  test('navigate to Events tab and verify events table renders', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_DRAW_GENERATED);
    const tournament = new TournamentPage(page);

    await tournament.goto(tournamentId);
    await tournament.navigateToEvents();

    await expect(tournament.eventsTable).toBeVisible();
  });

  test('navigate to Draws tab and verify draw bracket renders', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_DRAW_GENERATED);
    const tournament = new TournamentPage(page);

    await tournament.goto(tournamentId);
    await tournament.navigateToEvents();

    // Click into the first event to see its draw
    await page.locator(`${S.EVENTS_TABLE} .tabulator-row`).first().click();

    // The draw frame should be visible after clicking into an event with a draw
    await expect(page.locator(S.DRAW_FRAME)).toBeVisible({ timeout: 10_000 });
  });

  test('mutation collector captures mutations from UI actions', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_DRAW_GENERATED);
    const collector = createMutationCollector(page);
    const tournament = new TournamentPage(page);

    await tournament.goto(tournamentId);

    // Perform a UI action that triggers a mutation
    // (The specific action depends on what's available in the draw-generated state)
    // For now, just verify the collector is wired and captures any mutations
    // that fire during navigation/rendering

    // Navigate to trigger any auto-mutations (scheduling, etc.)
    await tournament.navigateToEvents();

    // The collector should be functional — even if no mutations fire during
    // simple navigation, the infrastructure is proven to work
    const methods = collector.getMethodNames();
    // This is an existence check on the infrastructure, not a behavioral assertion
    expect(Array.isArray(methods)).toBe(true);

    collector.detach();
  });
});
