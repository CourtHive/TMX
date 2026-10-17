/**
 * Journey 165 — a view route opens only a view the structure offers.
 *
 * Stats and Grid are offered for round robin (and ad hoc) structures only: an elimination structure has no tally.
 * The menu never offered them there, but the route did not ask: a typed, bookmarked or stale
 * `/draw/<drawId>/view/roundsStats` on an elimination draw rendered the stats table with no tab active, a table the
 * factory no longer fills: it tallies only round robin groups, ad hoc and lucky structures.
 *
 * The route now resolves the view through the same list the menu reads, falling back to the structure's default.
 */
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { test, expect, type Page } from '@playwright/test';
import { S } from '../helpers/selectors';

const TOURNAMENT_ID = 'e2e-rounds-view-route';
const EVENT_ID = 'e2e-rounds-view-event';
const DRAW_ID = 'e2e-rounds-view-draw';

function profile(drawType: string): MockProfile {
  return {
    tournamentName: 'E2E Rounds View Route',
    tournamentAttributes: { tournamentId: TOURNAMENT_ID },
    drawProfiles: [{ drawType, drawSize: 8, drawId: DRAW_ID, eventId: EVENT_ID, eventName: 'Singles' }],
    completeAllMatchUps: true,
  };
}

async function openRoute(page: Page, view: string) {
  // land on the loaded tournament first, so the route below is the last navigation rather than racing the load's own
  await new TournamentPage(page).goto(TOURNAMENT_ID);
  await page.goto(`/#/tournament/${TOURNAMENT_ID}/event/${EVENT_ID}/draw/${DRAW_ID}/view/${view}`);
  await expect(page.locator(S.DRAW_FRAME)).toBeVisible({ timeout: 15_000 });
}

function activeTab(page: Page) {
  return page.locator(`${S.DRAW_CONTROL} .options_left .tabs li.is-active a span`);
}

function statsHeader(page: Page) {
  return page.locator(`${S.DRAWS_VIEW} .tabulator-col-title`, { hasText: 'Match W/L' });
}

test.describe('Journey 165 — rounds view route fallback', () => {
  let pageErrors: string[];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('a stats route on an elimination draw opens its cards, not an empty stats table', async ({ page }) => {
    await seedTournament(page, profile('SINGLE_ELIMINATION'));
    await openRoute(page, 'roundsStats');

    await expect(activeTab(page)).toHaveText('Cards');
    await expect(page.locator(`${S.DRAW_CONTROL} .options_left .tabs li a span`, { hasText: 'Stats' })).toHaveCount(0);
    await expect(statsHeader(page)).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test('a grid route on an elimination draw opens its cards too', async ({ page }) => {
    await seedTournament(page, profile('SINGLE_ELIMINATION'));
    await openRoute(page, 'roundsBracket');

    await expect(activeTab(page)).toHaveText('Cards');
    await expect(page.locator(`${S.DRAWS_VIEW} .tabulator-col-title`)).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test('the same stats route on a round robin opens its stats', async ({ page }) => {
    await seedTournament(page, profile('ROUND_ROBIN'));
    await openRoute(page, 'roundsStats');

    await expect(activeTab(page)).toHaveText('Stats');
    await expect(statsHeader(page)).toBeVisible({ timeout: 10_000 });
    expect(pageErrors).toEqual([]);
  });
});
