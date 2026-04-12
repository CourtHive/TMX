import type { Page } from '@playwright/test';
import { S } from '../helpers/selectors';

/**
 * Page object for a tournament's detail view.
 * Covers the tab navigation (Overview, Participants, Events, etc.)
 * and common tournament-level actions.
 */
export class TournamentPage {
  constructor(private page: Page) {}

  async goto(tournamentId: string) {
    await this.page.goto(`/#/tournament/${tournamentId}`);
    // tmxContent becomes display:block when a tournament is loaded
    await this.page.waitForSelector(S.TMX_CONTENT, { state: 'visible', timeout: 15_000 });
  }

  // --- Navigation tabs ---

  async navigateToOverview() {
    await this.page.locator(S.NAV_OVERVIEW).click();
  }

  async navigateToParticipants() {
    await this.page.locator(S.NAV_PARTICIPANTS).click();
  }

  async navigateToEvents() {
    await this.page.locator(S.NAV_EVENTS).click();
    await this.page.waitForSelector(S.EVENTS_TABLE, { state: 'visible' });
  }

  async navigateToMatchUps() {
    await this.page.locator(S.NAV_MATCHUPS).click();
  }

  async navigateToSchedule() {
    await this.page.locator(S.NAV_SCHEDULE).click();
  }

  async navigateToSchedule2() {
    await this.page.locator(S.NAV_SCHEDULE2).click();
  }

  async navigateToVenues() {
    await this.page.locator(S.NAV_VENUES).click();
  }

  async navigateToSettings() {
    await this.page.locator(S.NAV_SETTINGS).click();
  }

  // --- Locators ---

  get eventsTable() {
    return this.page.locator(S.EVENTS_TABLE);
  }

  get participantsTable() {
    return this.page.locator(S.TOURNAMENT_PARTICIPANTS);
  }

  get matchUpsTable() {
    return this.page.locator(S.TOURNAMENT_MATCHUPS);
  }

  get venuesTable() {
    return this.page.locator(S.TOURNAMENT_VENUES);
  }

  get drawsView() {
    return this.page.locator(S.DRAWS_VIEW);
  }

  get scheduleGrid() {
    return this.page.locator(S.TOURNAMENT_SCHEDULE);
  }
}
