import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTeamTournamentWithStaff } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { test, expect } from '@playwright/test';

/**
 * Journey 137 — on the participants page for INDIVIDUAL competitors, a team pill in the Teams
 * column opens THAT team's card.
 *
 * CA, 2026-10-07: "clicking on the team that individual is associated with should open the TEAM
 * Card, not simply navigate to the TEAM Participants view". The pill names one team, so it opens
 * the same `teamProfileModal` a TEAM name opens in the TEAM view, and the page stays where it is.
 */

const TEAM_NAME_AUTHENTICS = 'The Authentics';
const TEAM_NAME_CAULDRON = 'Cauldron';

test.describe('Journey 137 — a team pill on the individuals table opens the team card', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('opens the clicked team card and stays on the individuals view', async ({ page }) => {
    const { tournamentId } = await seedTeamTournamentWithStaff(page, {
      teamNames: [TEAM_NAME_AUTHENTICS, TEAM_NAME_CAULDRON],
      playersPerTeam: 4,
      staff: [],
    });

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToParticipants();

    const pill = tournament.participantsTable.locator('.event-pill', { hasText: TEAM_NAME_CAULDRON }).first();
    await pill.waitFor({ state: 'visible', timeout: 15_000 });
    const urlBefore = page.url();
    await pill.click();

    // The card for the team that was clicked — not the other one, and not a navigation.
    const dialog = page.locator('.chc-modal-dialog');
    await expect(page.locator('.chc-modal-title')).toContainText(TEAM_NAME_CAULDRON);
    await expect(dialog.getByText('Roster (4)')).toBeVisible();
    expect(page.url()).toEqual(urlBefore);
    expect(page.url()).not.toMatch(/\/TEAM$/);
  });
});
