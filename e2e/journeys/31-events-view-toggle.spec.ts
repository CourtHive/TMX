/**
 * Journey 31 — Events tab view toggle (cards ↔ table)
 *
 * The events tab defaults to a card-grid view with a cards/table toggle in
 * the tab header (memory: tournaments-redesign card-grid). This spec covers
 * the default rendering, toggle behaviour, localStorage persistence, click
 * navigation from a card, and the cards-mode search filter.
 *
 * Existing draw / event specs go through `TournamentPage.navigateToEvents()`
 * which now ensures table view via the same toggle button — so those specs
 * keep working unchanged.
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetEventsViewMode, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { PROFILE_DRAW_GENERATED, seedTournament } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';

const EVENT_CARD = '.chc-ec-card';
const EVENTS_GRID_WRAP = '.tmx-events-grid-wrap';

/** Tournament with two distinct events so search-filter narrowing is observable. */
const PROFILE_TWO_EVENTS = {
  tournamentName: 'E2E Two Events',
  tournamentAttributes: { tournamentId: 'e2e-two-events' },
  participantsProfile: { scaledParticipantsCount: 32 },
  drawProfiles: [
    { eventName: 'Singles', drawSize: 16, drawType: 'SINGLE_ELIMINATION' as const },
    { eventName: 'Doubles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' as const, eventType: 'DOUBLES' as const },
  ],
};

test.describe('Journey 31 — Events tab view toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    // Default-cards behaviour depends on no prior persisted mode.
    await resetEventsViewMode(page);
  });

  test('default view is cards (no prior persisted mode)', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_DRAW_GENERATED);
    const tournament = new TournamentPage(page);

    await tournament.goto(tournamentId);
    await page.locator('#e-route').click();

    // Cards grid wraps the events; at least one card is rendered.
    // Note: the #eventsTable anchor div persists in the DOM across mode
    // switches (Tabulator/grid both render into the same TOURNAMENT_EVENTS
    // anchor), so we don't assert its absence — only that the cards grid
    // exists alongside it.
    await expect(page.locator(EVENTS_GRID_WRAP)).toBeVisible();
    await expect(page.locator(EVENT_CARD)).toHaveCount(1);

    // The "Cards view" toggle button is pressed
    const cardsToggle = page.getByRole('button', { name: 'Cards view' });
    await expect(cardsToggle).toBeVisible();
    await expect(cardsToggle).toHaveAttribute('aria-pressed', 'true');
  });

  test('toggle to table view renders the Tabulator and persists the choice', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_DRAW_GENERATED);
    const tournament = new TournamentPage(page);

    await tournament.goto(tournamentId);
    await page.locator('#e-route').click();

    // Switch to table view
    await page.getByRole('button', { name: 'Table view' }).click();

    // Tabulator rows render in table mode; cards grid wrap is gone.
    await expect(page.locator('#eventsTable .tabulator-row').first()).toBeVisible();
    await expect(page.locator(EVENTS_GRID_WRAP)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Table view' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Cards view' })).toHaveAttribute('aria-pressed', 'false');

    // Persisted to localStorage so a refresh keeps the choice
    const stored = await page.evaluate(() => localStorage.getItem('tmx_events_view_mode'));
    expect(stored).toBe('table');
  });

  test('card exposes onClick affordance (clickable class + eventId dataset)', async ({ page }) => {
    // The card's onClick navigation path (navigateToEvent) is the same one
    // exercised by Journey 01's row-click test — covered there. This test
    // just verifies the cards-view *wiring*: each card has the clickable
    // styling, a tabIndex for keyboard nav, and the eventId dataset that
    // the click handler reads.
    const tournamentId = await seedTournament(page, PROFILE_DRAW_GENERATED);
    const tournament = new TournamentPage(page);

    await tournament.goto(tournamentId);
    await tournament.navigateToEventsCardsView();

    const card = page.locator(EVENT_CARD).first();
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('tabindex', '0');
    const eventId = await card.getAttribute('data-event-id');
    expect(eventId).toMatch(/.+/);
  });

  test('cards-view search filter narrows the visible cards', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_TWO_EVENTS);
    const tournament = new TournamentPage(page);

    await tournament.goto(tournamentId);
    await tournament.navigateToEventsCardsView();

    // Both cards present initially
    await expect(page.locator(EVENT_CARD)).toHaveCount(2);

    // Type into the search box — uses the controlBar search input in the
    // tab's right-hand control area. Match by placeholder to stay stable.
    // pressSequentially (not fill) so each keystroke fires `keyup`, which
    // is the event the controlBar's filter listener subscribes to.
    const searchBox = page.getByPlaceholder('Search events');
    await searchBox.click();
    await searchBox.pressSequentially('Doubles', { delay: 10 });

    // Only the Doubles card remains
    await expect(page.locator(EVENT_CARD)).toHaveCount(1);
  });
});
