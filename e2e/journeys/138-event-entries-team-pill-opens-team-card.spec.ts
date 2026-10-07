import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTeamTournamentWithStaff } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { test, expect } from '@playwright/test';
import { S } from '../helpers/selectors';

/**
 * Journey 138 — on an event's entries, a team pill in the Teams column opens THAT team's card.
 *
 * CA, 2026-10-07: "yes, on the event entries they should also open the team card" — the same rule
 * journey 137 pins for the participants page. The pill names one team, so it opens
 * `teamProfileModal` for it rather than navigating to the TEAM participants view.
 *
 * The Teams column shows only when an entry's participant belongs to a team, which the TEAM event
 * the seed creates cannot provide (its entries ARE the teams). So the journey adds a SINGLES event
 * entered by one member of each team.
 */

const TEAM_NAME_AUTHENTICS = 'The Authentics';
const TEAM_NAME_CAULDRON = 'Cauldron';
const EVENT_NAME = 'Team Pill Singles';

test.describe('Journey 138 — a team pill on event entries opens the team card', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('opens the clicked team card and stays on the entries view', async ({ page }) => {
    const { tournamentId, teamIds } = await seedTeamTournamentWithStaff(page, {
      teamNames: [TEAM_NAME_AUTHENTICS, TEAM_NAME_CAULDRON],
      playersPerTeam: 4,
      staff: [],
    });

    await page.evaluate(
      async ({ teamIds, eventName }) => {
        const te = dev.factory.tournamentEngine;
        const { participants } = te.getParticipants({ participantFilters: { participantTypes: ['TEAM'] } });
        const memberOf = (teamId: string) =>
          participants.find((p: any) => p.participantId === teamId)?.individualParticipantIds?.[0];
        const entrants = Object.values(teamIds).map((teamId) => memberOf(teamId as string));
        if (entrants.some((id) => !id)) throw new Error('a seeded team has no members');
        const { event } = te.addEvent({ event: { eventName, eventType: 'SINGLES' } });
        te.addEventEntries({ eventId: event.eventId, participantIds: entrants });
        await dev.tmx2db.addTournament(te.getTournament().tournamentRecord);
      },
      { teamIds, eventName: EVENT_NAME },
    );

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToEvents();
    await tournament.eventsTable.locator('.tabulator-row', { hasText: EVENT_NAME }).first().click();
    const entriesVisible = await page
      .locator(S.ENTRIES_VIEW)
      .isVisible()
      .catch(() => false);
    if (!entriesVisible) await page.locator('#eventTabsBar').getByText('Entries').click();
    await page.waitForSelector(S.ENTRIES_VIEW, { state: 'visible', timeout: 10_000 });

    const pill = page.locator(S.ENTRIES_VIEW).locator('.event-pill', { hasText: TEAM_NAME_CAULDRON }).first();
    await pill.waitFor({ state: 'visible', timeout: 15_000 });
    const urlBefore = page.url();
    await pill.click();

    // The card for the team that was clicked, and no navigation.
    await expect(page.locator('.chc-modal-title')).toContainText(TEAM_NAME_CAULDRON);
    await expect(page.locator('.chc-modal-dialog').getByText('Roster (4)')).toBeVisible();
    expect(page.url()).toEqual(urlBefore);
    expect(page.url()).not.toMatch(/\/TEAM$/);
  });
});
