/**
 * Journey 32 — Draw-card visualizations (histogram / competitiveness / sunburst)
 *
 * On the per-event draws-list view (multiple draws under one event), each
 * card can render an optional visualization above the body. The palette
 * icon in the draws header opens a popover that picks the active mode;
 * the selection persists in `localStorage['tmx_draws_card_display']`.
 *
 * This spec seeds an event with two completed draws (so a draws-list view
 * is rendered, all matchUps have scores, and ratings are present on
 * participants), then toggles through each viz mode and asserts that the
 * expected element appears inside each card.
 *
 * Sunburst is only available when fewer than 6 draws — with 2 draws it's
 * listed in the popover.
 */
import { test, expect } from '@playwright/test';
import {
  ensureDrawsGridMode,
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
// The competitiveness viz now uses the donut variant from courthive-components
// (`.chc-cd`) — the segmented bar (`.chc-cb`) primitive still exists and is
// used elsewhere (matchUps page). Either is acceptable here, but the assertion
// matches whichever the consumer is currently wired to.
const COMPETITIVENESS_VIZ = '.chc-cd';
const PALETTE_BUTTON = 'button[aria-label="Card display options"]';

/** One event with two completed draws — so we land on the
 * draws-list view (renderDrawsTableView only fires when count > 1).
 * `eventProfiles` is the canonical mocksEngine shape for grouping
 * multiple drawProfiles under a single event; flat top-level
 * `drawProfiles` would create N separate events. All matchUps are
 * scored so `competitiveProfile` is populated when matchUps are
 * fetched with `contextProfile.withCompetitiveness`. */
const PROFILE_TWO_DRAWS_COMPLETED = {
  tournamentName: 'E2E Draw Viz',
  tournamentAttributes: { tournamentId: 'e2e-draw-viz' },
  // `category` with a `ratingType` + `scaledParticipantsCount` makes
  // mocksEngine attach numeric scale values to participants — required
  // for the histogram option to be enabled in the popover.
  participantsProfile: {
    scaledParticipantsCount: 32,
    scaleAllParticipants: true,
    category: { ratingType: 'WTN', ratingMin: 10, ratingMax: 25 },
  },
  eventProfiles: [
    {
      eventId: 'e2e-singles',
      eventName: 'Singles',
      category: { ratingType: 'WTN', ratingMin: 10, ratingMax: 25 },
      drawProfiles: [
        { drawSize: 16, drawType: 'SINGLE_ELIMINATION' as const },
        { drawSize: 16, drawType: 'SINGLE_ELIMINATION' as const },
      ],
    },
  ],
  completeAllMatchUps: true,
};

async function gotoDrawsList(page: import('@playwright/test').Page, tournamentId: string): Promise<void> {
  // Look up the single event's id from the engine, then navigate straight
  // to its draws-list URL — bypasses the "click event card" navigation so
  // the test stays focused on the viz toggle behaviour.
  const eventId = await page.evaluate(() => {
    const { tournamentRecord } = dev.factory.tournamentEngine.getTournament();
    return tournamentRecord?.events?.[0]?.eventId as string | undefined;
  });
  expect(eventId).toBeTruthy();
  await page.goto(`/#/tournament/${tournamentId}/event/${eventId}/draws`);
  await page.locator(DRAW_CARD).first().waitFor({ state: 'visible', timeout: 10_000 });
}

async function openDisplayOptions(page: import('@playwright/test').Page): Promise<void> {
  await page.locator(PALETTE_BUTTON).click();
  // Wait for the popover to mount in the body (tippy appendTo).
  await page.locator('input[name="drawCardDisplay"]').first().waitFor({ state: 'visible', timeout: 5_000 });
}

async function pickDisplayMode(page: import('@playwright/test').Page, value: string): Promise<void> {
  await openDisplayOptions(page);
  // `.click()` (not `.check()`) — the popover destroys itself on change
  // before Playwright's `.check()` can verify the radio is still in the
  // DOM as checked. The click fires the change handler the same way.
  await page.locator(`input[name="drawCardDisplay"][value="${value}"]`).click();
}

test.describe('Journey 32 — Draw-card visualizations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await resetEventsViewMode(page);
    // Clear any saved card-display mode, then opt into the card grid — the
    // draws-list now defaults to table view (f2a85a90), so these card-viz
    // specs must select grid mode explicitly.
    await resetDrawsViewState(page);
    await ensureDrawsGridMode(page);
  });

  test('competitiveness mode renders a segmented bar in every card', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_TWO_DRAWS_COMPLETED);
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);

    await gotoDrawsList(page, tournamentId);
    await expect(page.locator(DRAW_CARD)).toHaveCount(2);
    // No viz initially (default 'none')
    await expect(page.locator(VIZ_ZONE)).toHaveCount(0);

    await pickDisplayMode(page, 'competitiveness');
    // Two cards × one viz each.
    await expect(page.locator(VIZ_ZONE)).toHaveCount(2);
    await expect(page.locator(`${DRAW_CARD} ${COMPETITIVENESS_VIZ}`)).toHaveCount(2);

    // Preference persisted to localStorage as the global TD preference.
    const stored = await page.evaluate(() => localStorage.getItem('tmx_draws_card_display'));
    expect(stored).toBe('competitiveness');
  });

  test('histogram mode renders an SVG above each card body', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_TWO_DRAWS_COMPLETED);
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);

    await gotoDrawsList(page, tournamentId);
    await pickDisplayMode(page, 'histogram');

    await expect(page.locator(VIZ_ZONE)).toHaveCount(2);
    // The chart factory emits an <svg> root — assert at least one SVG inside
    // each viz zone. Doesn't bind to internal class names of the chart.
    await expect(page.locator(`${DRAW_CARD} ${VIZ_ZONE} svg`).first()).toBeVisible();
    expect(await page.locator(`${DRAW_CARD} ${VIZ_ZONE} svg`).count()).toBeGreaterThanOrEqual(2);
  });

  test('sunburst mode renders an SVG and expands the grid columns', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_TWO_DRAWS_COMPLETED);
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);

    await gotoDrawsList(page, tournamentId);
    await pickDisplayMode(page, 'sunburst');

    await expect(page.locator(VIZ_ZONE)).toHaveCount(2);
    await expect(page.locator(`${DRAW_CARD} ${VIZ_ZONE} svg`).first()).toBeVisible();

    // The grid wrapper carries the expanded class only in sunburst mode.
    await expect(page.locator('.tmx-draws-grid')).toHaveClass(/tmx-draws-grid--expanded/);
  });

  test('switching back to None removes the viz zone and clears the expanded class', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_TWO_DRAWS_COMPLETED);
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);

    await gotoDrawsList(page, tournamentId);

    // Pick something, then clear back to None.
    await pickDisplayMode(page, 'sunburst');
    await expect(page.locator(VIZ_ZONE)).toHaveCount(2);

    await pickDisplayMode(page, 'none');
    await expect(page.locator(VIZ_ZONE)).toHaveCount(0);
    await expect(page.locator('.tmx-draws-grid')).not.toHaveClass(/tmx-draws-grid--expanded/);
  });
});
