import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { test, expect } from '@playwright/test';

/**
 * Journey 41 — Schedule2 grid refreshes after Add venue (drawer flow)
 *
 * Regression: clicking the "Add venue" button rendered in the schedule2
 * grid's empty-state placeholder used to call renderSchedule2Tab on success,
 * which short-circuited back to a router navigate when the module-level
 * currentDate happened to be empty — leaving the venue added in state but
 * never reflected in the rendered grid. handleAddVenue now refreshes via
 * the same in-place onRefresh path every other mutation uses, so the new
 * venue's first court column header shows up after the drawer closes.
 *
 * This test seeds a tournament with NO venues so the placeholder + Add
 * venue button render, drives the drawer to add a venue with 2 courts,
 * and asserts the grid grew a "Court 1" header after submit.
 */

const SCHEDULE_DATE = new Date().toISOString().slice(0, 10);

const PROFILE_NO_VENUES: MockProfile = {
  tournamentName: 'E2E Add Venue Refresh',
  tournamentAttributes: {
    tournamentId: 'e2e-add-venue-refresh',
    startDate: SCHEDULE_DATE,
    endDate: SCHEDULE_DATE,
  },
  participantsProfile: { scaledParticipantsCount: 8 },
  drawProfiles: [
    {
      eventName: 'No-Venue Singles',
      drawSize: 8,
      seedsCount: 2,
      drawType: 'SINGLE_ELIMINATION',
    },
  ],
  // Intentionally no venueProfiles — schedule2 should render the placeholder
  // with an Add venue button as its sole emptyCount column.
};

test.describe('Journey 41 — Schedule2 Add venue refresh', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('Add venue from grid placeholder refreshes the grid with the new court(s)', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_NO_VENUES);
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToSchedule2();

    // Seed has no venues — the only emptyCount column hosts a real button
    // (not a span). Click it to open the addVenue drawer.
    const addVenueButton = page.locator('button:has-text("Add venue")').first();
    await addVenueButton.waitFor({ state: 'visible', timeout: 10_000 });

    // Sanity: no "Court 1" header in the grid yet.
    await expect(page.locator('text=Court 1')).toHaveCount(0);

    await addVenueButton.click();

    // The drawer renders via #tmxDrawer .drawer__wrapper.
    const drawer = page.locator('#tmxDrawer');
    await drawer.locator('.drawer__wrapper').waitFor({ state: 'visible', timeout: 10_000 });

    // Fill the required fields. Field labels come from the i18n bundle and
    // the en.json keys are stable.
    const venueNameInput = drawer.locator('.field:has(.label:text-is("Venue name")) input.input');
    const venueAbbrInput = drawer.locator('.field:has(.label:text-is("Abbreviation")) input.input');
    const numCourtsInput = drawer.locator('.field:has(.label:text-is("Number of courts")) input.input');

    await venueNameInput.fill('Center Court Complex');
    await venueAbbrInput.fill('CCC');
    await numCourtsInput.fill('2');

    // The Add button is disabled until enableSubmit fires — type+blur to flush.
    await numCourtsInput.blur();
    const submitBtn = drawer.locator('#addVenueButton');
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 });

    await submitBtn.click();

    // Drawer closes (close: true on the button), then the refresh callback
    // fires once the mutation completes. Court 1 header should appear.
    await drawer.locator('.drawer__wrapper').waitFor({ state: 'hidden', timeout: 10_000 });

    await expect(page.locator('text=Court 1').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Court 2').first()).toBeVisible({ timeout: 5_000 });
  });
});
