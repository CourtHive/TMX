import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, PROFILE_EMPTY_TOURNAMENT } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 99 — the venues TABLE shows a venue the moment it is added, by either add path.
 *
 * Why this exists: `updateVenueRow` used to refresh only the tab header in table mode, on the
 * assumption that the table "self-updates via dataChanged". Tabulator fires `dataChanged` only for
 * data changed *through* the table (inline edit, `addRow`, `deleteRow`) — never for a factory
 * mutation applied elsewhere — so nothing re-read the engine, the row never appeared, and the
 * header reported the stale count. Grid mode was unaffected because it re-renders from the engine.
 *
 * Journey 92 covers the registry add but asserts only on the mutation payload and the tournament
 * record, so it passed with the bug present. This file asserts on the rendered table.
 *
 * Both add paths are exercised deliberately. They pass different arguments to the same callback —
 * `addVenue.ts` sends `{ ...result, venue }`, `addVenueFromRegistry.ts` sends a bare `result` — so
 * a refresh that read the venue off the argument would work here for hand entry and silently no-op
 * for the registry. Covering only one route would not catch that.
 */

const VENUES_TABLE = '#venuesTable';
const NAME_CELL = `${VENUES_TABLE} .tabulator-cell[tabulator-field="venueName"]`;
const HEADER = '.section:has(#venuesTable) .tabHeader';
const VIEW_MODE_KEY = 'tmx_venues_view_mode';

const AMS = '**/facilities/**';

const CANDIDATES = {
  results: [
    { facilityId: 'fac-life', name: 'Life Time Peachtree', city: 'Atlanta', countryCode: 'USA', courtCount: 7 },
  ],
};

const REGISTRY_VENUE = {
  venueId: 'fac-life',
  facilityId: 'fac-life',
  venueName: 'Life Time Peachtree',
  addresses: [{ city: 'Atlanta', countryCode: 'USA' }],
  courts: [
    { courtId: 'court-a', courtName: 'Court 1', courtOrder: 1 },
    { courtId: 'court-b', courtName: 'Court 2', courtOrder: 2 },
  ],
};

async function stubRegistry(page: Page) {
  await page.route(AMS, (route) => {
    const url = route.request().url();
    if (url.includes('/facilities/search')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CANDIDATES) });
    }
    if (url.includes('/venue')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(REGISTRY_VENUE) });
    }
    return route.continue();
  });
}

/** The registry lookup button is gated on a signed-in session; an unsigned JWT with a future `exp` clears it. */
async function stubSignedInSession(page: Page) {
  await page.evaluate(() => {
    const b64 = (o: any) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const exp = Math.floor(Date.now() / 1000) + 3600;
    localStorage.setItem('tmxToken', `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ exp, roles: [], provider: {} })}.`);
  });
}

async function gotoVenues(page: Page, viewMode: 'table' | 'grid') {
  const tournamentId = await seedTournament(page, PROFILE_EMPTY_TOURNAMENT);
  await stubSignedInSession(page);
  // Table is the default, but the bug is mode-specific — pin it rather than inherit it.
  await page.evaluate(([key, mode]) => localStorage.setItem(key, mode), [VIEW_MODE_KEY, viewMode] as const);
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToVenues();
}

/** Fill the hand-entry drawer and save. Fields carry no ids, so target them by their label. */
async function addVenueByHand(page: Page, { name, abbreviation, courts }: Record<string, string>) {
  await page.locator('#addVenue').click();
  const field = (label: string) => page.locator(`.drawer .field:has(label.label:text-is("${label}")) input`).first();
  await expect(field('Venue name')).toBeVisible({ timeout: 5_000 });
  await field('Venue name').fill(name);
  await field('Abbreviation').fill(abbreviation);
  await field('Number of courts').fill(courts);
  const save = page.locator('#addVenueButton');
  await expect(save).toBeEnabled({ timeout: 5_000 });
  await save.click();
}

async function addVenueFromRegistry(page: Page) {
  await page.locator('#addVenue').click();
  const lookup = page.locator('#facilityRegistryLookup');
  await expect(lookup).toBeVisible({ timeout: 5_000 });
  await lookup.click();
  await page.getByPlaceholder('Search facilities by name').fill('life');
  const candidate = page.locator('[data-facility-id="fac-life"]');
  await expect(candidate).toBeVisible({ timeout: 5_000 });
  await candidate.click();
  await expect(page.locator('#facilityPreview')).toContainText('Court 1', { timeout: 5_000 });
  await page.getByRole('button', { name: 'Add to tournament' }).click();
}

test.describe('Journey 99 — the venues table refreshes when a venue is added', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('hand entry adds the row to the table and updates the header count', async ({ page }) => {
    await gotoVenues(page, 'table');
    await expect(page.locator(HEADER)).toContainText('Venues (0)');

    await addVenueByHand(page, { name: 'Greenwood Racquet Club', abbreviation: 'GRC', courts: '4' });

    await expect(page.locator(NAME_CELL)).toContainText('Greenwood Racquet Club', { timeout: 8_000 });
    await expect(page.locator(HEADER)).toContainText('Venues (1)');
  });

  test('a registry add lands the row too — the refresh cannot depend on the callback argument', async ({ page }) => {
    await stubRegistry(page);
    await gotoVenues(page, 'table');
    await expect(page.locator(HEADER)).toContainText('Venues (0)');

    await addVenueFromRegistry(page);

    // The registry path passes no `venue` to the callback. Reading one off the argument would leave
    // this assertion red while the hand-entry test above stayed green.
    await expect(page.locator(NAME_CELL)).toContainText('Life Time Peachtree', { timeout: 8_000 });
    await expect(page.locator(HEADER)).toContainText('Venues (1)');
  });

  test('grid mode is unaffected — the control that localises the fix to the table path', async ({ page }) => {
    await gotoVenues(page, 'grid');

    await addVenueByHand(page, { name: 'Greenwood Racquet Club', abbreviation: 'GRC', courts: '4' });

    // Grid mode re-renders from the engine and was already correct. This assertion holds both with
    // and without the table fix, so it proves the two table tests above isolate the table path
    // rather than an unrelated failure to add the venue at all.
    await expect(page.locator('.tmx-venues-grid')).toContainText('Greenwood Racquet Club', { timeout: 8_000 });
  });
});
