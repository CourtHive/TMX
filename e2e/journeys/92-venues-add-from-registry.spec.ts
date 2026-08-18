import { test, expect, Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { seedTournament, PROFILE_EMPTY_TOURNAMENT } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 92 — WS2: add a tournament venue from the canonical facility registry.
 *
 * Why this exists: the hand-entry Add Venue form mints a venueId and courtIds local to the
 * tournament, so the same physical club entered twice becomes two unrelated venues. A registry
 * venue arrives carrying its canonical `facilityId` and court ids, which is what makes "every
 * tournament at this facility" a join instead of a name match.
 *
 * The AMS passthrough is stubbed at the network layer with `page.route`. The registry's own
 * behaviour is covered in courthive-facilities, and AMS's passthrough in its controller spec —
 * what is untested until here is TMX's half: that a chosen candidate becomes an `addVenue`
 * carrying the registry's ids rather than freshly minted ones.
 */

const AMS = '**/facilities/**';

const CANDIDATES = {
  results: [
    {
      facilityId: 'fac-life',
      name: 'Life Time Peachtree',
      city: 'Atlanta',
      countryCode: 'USA',
      courtCount: 7,
      matchedOn: 'name',
    },
    {
      facilityId: 'fac-lake',
      name: 'Lakeside Racquet Club',
      city: 'Marietta',
      countryCode: 'USA',
      courtCount: 4,
      matchedOn: 'alias',
    },
  ],
};

const VENUE = {
  venueId: 'fac-life',
  facilityId: 'fac-life',
  venueName: 'Life Time Peachtree',
  addresses: [{ city: 'Atlanta', countryCode: 'USA', latitude: 33.848, longitude: -84.3733 }],
  courts: [
    { courtId: 'court-a', courtName: 'Court 1', surfaceCategory: 'HARD', indoorOutdoor: 'OUTDOOR', courtOrder: 1 },
    { courtId: 'court-b', courtName: 'Court 2', surfaceCategory: 'HARD', indoorOutdoor: 'INDOOR', courtOrder: 2 },
  ],
};

/** Stub the AMS passthrough. Returns the recorded request URLs so a test can assert what was called. */
async function stubRegistry(page: Page, opts: { venue?: any; venueStatus?: number } = {}) {
  const calls: string[] = [];
  await page.route(AMS, async (route) => {
    const url = route.request().url();
    calls.push(url);
    if (url.includes('/facilities/search')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CANDIDATES) });
    }
    if (url.includes('/venue')) {
      const status = opts.venueStatus ?? 200;
      if (status !== 200) return route.fulfill({ status, contentType: 'application/json', body: '{}' });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(opts.venue ?? VENUE),
      });
    }
    return route.continue();
  });
  return calls;
}

/**
 * The registry button is gated on a signed-in session — a logged-out user has no token to search
 * with, so offering it would only 401. The spec stubs the session the same way it stubs the
 * network: `validateToken` decodes the JWT locally and checks `exp`, so an unsigned token with a
 * future expiry is enough to exercise the UI without a CFS login (and without the 10/min login
 * throttle that makes the CFS-gated journeys skip at suite scale).
 */
async function stubSignedInSession(page: Page) {
  await page.evaluate(() => {
    const b64 = (o: any) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ exp, roles: [], provider: {} })}.`;
    localStorage.setItem('tmxToken', token);
  });
}

async function openRegistryPicker(page: Page) {
  await page.locator('#addVenue').click();
  const lookup = page.locator('#facilityRegistryLookup');
  await expect(lookup).toBeVisible({ timeout: 5_000 });
  await lookup.click();
  await expect(page.getByPlaceholder('Search facilities by name')).toBeVisible({ timeout: 5_000 });
}

async function gotoVenues(page: Page) {
  const tournamentId = await seedTournament(page, PROFILE_EMPTY_TOURNAMENT);
  await stubSignedInSession(page);
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToVenues();
  return tournamentId;
}

test.describe('Journey 92 — add venue from the facility registry', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('a chosen candidate is added carrying the registry facilityId and court ids', async ({ page }) => {
    await stubRegistry(page);
    await gotoVenues(page);
    const collector = createMutationCollector(page);

    await openRegistryPicker(page);
    await page.getByPlaceholder('Search facilities by name').fill('life');

    const candidate = page.locator('[data-facility-id="fac-life"]');
    await expect(candidate).toBeVisible({ timeout: 5_000 });
    // The row explains itself — court count and why the registry surfaced it.
    await expect(candidate).toContainText('7 courts');
    await expect(candidate).toContainText('matched name');
    await candidate.click();

    // Preview renders the venue and its courts before anything is committed.
    await expect(page.locator('#facilityPreview')).toContainText('Court 1', { timeout: 5_000 });

    await page.getByRole('button', { name: 'Add to tournament' }).click();
    const entry = await collector.waitForMethod('addVenue', 10_000);
    const params: any = entry.methods.find((m) => m.method === 'addVenue')?.params;

    // The point of WS2: canonical ids survive into the tournament record rather than being minted.
    expect(params?.venue?.facilityId).toBe('fac-life');
    expect(params?.venue?.venueId).toBe('fac-life');
    expect(params?.venue?.courts?.map((c: any) => c.courtId)).toEqual(['court-a', 'court-b']);

    // And the venue actually lands, courts included — one mutation, no companion addCourts.
    await expect
      .poll(() => page.evaluate(() => dev.getTournament().venues?.[0]?.courts?.length ?? 0), { timeout: 8_000 })
      .toBe(2);
    const venue: any = await page.evaluate(() => dev.getTournament().venues?.[0]);
    expect(venue.facilityId).toBe('fac-life');

    collector.detach();
  });

  test('a single result is still only a candidate — nothing auto-selects', async ({ page }) => {
    await page.route(AMS, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [CANDIDATES.results[0]] }),
      }),
    );
    await gotoVenues(page);
    const collector = createMutationCollector(page);

    await openRegistryPicker(page);
    await page.getByPlaceholder('Search facilities by name').fill('life');
    await expect(page.locator('[data-facility-id="fac-life"]')).toBeVisible({ timeout: 5_000 });

    // A sole hit must NOT resolve itself into a preview or a mutation.
    await expect(page.locator('#facilityPreview')).toBeEmpty();
    expect(collector.hasMethod('addVenue')).toBe(false);

    collector.detach();
  });

  test('a query below the registry minimum never reaches the network', async ({ page }) => {
    const calls = await stubRegistry(page);
    await gotoVenues(page);

    await openRegistryPicker(page);
    await page.getByPlaceholder('Search facilities by name').fill('l');
    await page.waitForTimeout(600);

    // The registry 400s a one-character query; firing it anyway would show the user a server
    // error for their first keystroke.
    expect(calls.filter((u) => u.includes('/facilities/search'))).toEqual([]);
    await expect(page.getByText('Type at least 2 characters to search')).toBeVisible();
  });

  test('a facility whose venue is missing reports it instead of failing silently', async ({ page }) => {
    await stubRegistry(page, { venueStatus: 404 });
    await gotoVenues(page);
    const collector = createMutationCollector(page);

    await openRegistryPicker(page);
    await page.getByPlaceholder('Search facilities by name').fill('life');
    await page.locator('[data-facility-id="fac-life"]').click();

    await expect(page.getByText('That facility has no venue record')).toBeVisible({ timeout: 5_000 });
    expect(collector.hasMethod('addVenue')).toBe(false);

    collector.detach();
  });
});
