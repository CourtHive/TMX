import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { seedTournament, PROFILE_DRAW_GENERATED } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/**
 * Journey 75 — Venues: add venue + courts (atomic), the scheduling foundation.
 *
 * addVenue() batches ADD_VENUE + ADD_COURTS into one mutationRequest. Venues are
 * untested apart from schedule2's add-venue-refresh (#41), yet a broken add-venue
 * silently blocks all scheduling. Drives the real drawer form and asserts both
 * methods ship in a single request and the venue + courts land in the factory.
 */

const DRAWER_FIELD = (label: string) => `${S.TMX_DRAWER} .field:has(.label:text-is("${label}")) input.input`;

async function fillField(page: Page, label: string, value: string): Promise<void> {
  await page.locator(DRAWER_FIELD(label)).fill(value);
}

test.describe('Journey 75 — add venue with courts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('add venue dispatches addVenue + addCourts in one request and the venue appears', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_DRAW_GENERATED);
    const collector = createMutationCollector(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToVenues();

    // Open the add-venue drawer (control-bar item id 'addVenue').
    await page.locator('#addVenue').click();
    await page.locator(`${S.TMX_DRAWER} .drawer__wrapper`).waitFor({ state: 'visible', timeout: 15_000 });

    await fillField(page, 'Venue name', 'Center Court Complex');
    await fillField(page, 'Abbreviation', 'CCC');
    await fillField(page, 'Number of courts', '4');

    // Submit enables once the form validates (name ≥5, abbreviation 2–6, count numeric).
    const submit = page.locator('#addVenueButton');
    await expect(submit).toBeEnabled({ timeout: 5_000 });
    await submit.click();

    // One request carrying both ADD_VENUE and ADD_COURTS.
    const entry = await collector.waitForMethod('addVenue', 10_000);
    const methodNames = entry.methods.map((m) => m.method);
    expect(methodNames).toContain('addVenue');
    expect(methodNames).toContain('addCourts');

    // The venue + its 4 courts landed in the factory.
    const venue = await page.evaluate(() => {
      const venues = dev.factory.tournamentEngine.getVenuesAndCourts()?.venues ?? [];
      const v = venues.find((x: any) => x.venueName === 'Center Court Complex');
      return v ? { name: v.venueName, courts: (v.courts ?? []).length } : null;
    });
    expect(venue).toEqual({ name: 'Center Court Complex', courts: 4 });

    collector.detach();
  });
});
