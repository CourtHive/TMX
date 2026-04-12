import type { Page } from '@playwright/test';
import { S } from '../helpers/selectors';

/**
 * Page object for the tournaments calendar/list view.
 * This is the landing page of TMX — the table of tournaments.
 */
export class CalendarPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/');
    // Calendar page shows either the welcome view or the tournaments table
    // — wait for navbar (#dnav) as the stable "app is ready" signal
    await this.page.waitForSelector('#dnav', { state: 'visible' });
  }

  /** The tournaments list table */
  get table() {
    return this.page.locator(S.TOURNAMENTS_TABLE);
  }

  /** The control bar above the tournaments table */
  get controlBar() {
    return this.page.locator(S.TOURNAMENTS_CONTROL);
  }

  /** Count visible tournament rows */
  async getTournamentCount(): Promise<number> {
    // Tabulator rows are .tabulator-row elements inside the table
    return this.page.locator(`${S.TOURNAMENTS_TABLE} .tabulator-row`).count();
  }

  /** Click the "Add tournament" button (or equivalent) */
  async clickAddTournament() {
    await this.page.getByRole('button', { name: /add|new|create/i }).click();
  }

  /** Open a tournament by clicking its row */
  async openTournament(tournamentName: string) {
    await this.page.locator(`${S.TOURNAMENTS_TABLE} .tabulator-row`).filter({ hasText: tournamentName }).click();
  }
}
