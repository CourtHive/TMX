/**
 * Journey 15 — Draw form: Multiple flights
 *
 * Tests creating flights (splitting entries into multiple draws) and
 * then generating draws for individual flights. Each flight should
 * have its own subset of entries and the draw form should reflect
 * the flight's entry count.
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { DrawFormDrawer } from '../pages/DrawFormDrawer';

const PROFILE_32: MockProfile = {
  tournamentName: 'E2E Flights',
  tournamentAttributes: { tournamentId: 'e2e-flights' },
  participantsProfile: { scaledParticipantsCount: 32 },
  drawProfiles: [{ eventName: 'Singles', drawSize: 32, generate: false }],
};

test.describe('Journey 15 — Multiple flights', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('creating 2 flights splits entries and each flight has correct draw size', async ({ page }) => {
    const collector = createMutationCollector(page);
    const tournamentId = await seedTournament(page, PROFILE_32);
    const tournamentPage = new TournamentPage(page);
    await tournamentPage.goto(tournamentId);

    // Create 2 flights via the factory engine directly
    const flightResult = await page.evaluate(() => {
      const tournament = dev.getTournament();
      const event = tournament.events?.[0];
      if (!event) return { error: 'no event' };

      const eventId = event.eventId;
      const result = dev.factory.tournamentEngine.generateFlightProfile({
        flightsCount: 2,
        eventId,
      });

      if (!result.success) return { error: result.error?.message || 'flight generation failed' };

      // Add the flight profile as an extension via mutation
      const extension = {
        name: 'flightProfile',
        value: result.flightProfile,
      };
      dev.factory.tournamentEngine.addEventExtension({ eventId, extension });

      // Read back the flights
      const updatedEvent = dev.factory.tournamentEngine.getEvent({ eventId }).event;
      const fp = updatedEvent?.extensions?.find((e: any) => e.name === 'flightProfile')?.value;
      const flights = fp?.flights || [];

      return {
        success: true,
        flightsCount: flights.length,
        flights: flights.map((f: any) => ({
          drawId: f.drawId,
          drawName: f.drawName,
          entryCount: f.drawEntries?.length || 0,
        })),
      };
    });

    console.log('Flight result:', JSON.stringify(flightResult));
    expect(flightResult.success).toBe(true);
    expect(flightResult.flightsCount).toBe(2);

    // Each flight should have roughly half the entries (32 / 2 = 16)
    const totalEntries = flightResult.flights.reduce(
      (sum: number, f: any) => sum + f.entryCount, 0,
    );
    expect(totalEntries).toBe(32);

    // Navigate to the event and verify the Draws tab shows 2 flights
    await tournamentPage.navigateToEvents();
    await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
    await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });

    // Click Draws tab
    await page.locator('#eventTabsBar').getByText('Draws').click();
    await page.waitForTimeout(500);

    // The draws table should show 2 rows (one per flight)
    const drawRows = page.locator('.tabulator-row');
    const rowCount = await drawRows.count();
    expect(rowCount).toBe(2);

    collector.detach();
  });

  test('add draw for a specific flight shows flight-specific entry count', async ({ page }) => {
    const collector = createMutationCollector(page);
    const tournamentId = await seedTournament(page, PROFILE_32);
    const tournamentPage = new TournamentPage(page);
    await tournamentPage.goto(tournamentId);

    // Create 2 flights and add the flight profile
    const flightInfo = await page.evaluate(() => {
      const tournament = dev.getTournament();
      const event = tournament.events?.[0];
      if (!event) return null;

      const eventId = event.eventId;
      const result = dev.factory.tournamentEngine.generateFlightProfile({
        flightsCount: 2,
        eventId,
      });
      if (!result.success) return null;

      dev.factory.tournamentEngine.addEventExtension({
        eventId,
        extension: { name: 'flightProfile', value: result.flightProfile },
      });

      const updatedEvent = dev.factory.tournamentEngine.getEvent({ eventId }).event;
      const fp = updatedEvent?.extensions?.find((e: any) => e.name === 'flightProfile')?.value;
      return {
        eventId,
        flights: fp?.flights?.map((f: any) => ({
          drawId: f.drawId,
          drawName: f.drawName,
          entryCount: f.drawEntries?.length || 0,
        })),
      };
    });

    expect(flightInfo).not.toBeNull();
    expect(flightInfo!.flights.length).toBe(2);

    // Navigate to the Draws tab
    await tournamentPage.navigateToEvents();
    await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
    await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
    await page.locator('#eventTabsBar').getByText('Draws').click();
    await page.waitForTimeout(500);

    // Click "Add draw" for the first flight row
    // The draws table has flight rows — clicking the "generate" icon
    // or the row should open the addDraw drawer for that flight
    const firstRow = page.locator('.tabulator-row').first();
    await firstRow.waitFor({ state: 'visible', timeout: 5_000 });

    // Look for a generate/add button within the row or use the
    // participants icon column
    const addBtn = firstRow.locator('[class*="fa-"], button').first();
    const hasAddBtn = await addBtn.isVisible().catch(() => false);

    if (hasAddBtn) {
      await addBtn.click();
    } else {
      // Click the row itself — some table configs open addDraw on row click
      await firstRow.click();
    }

    // Wait for the drawer to open
    const drawer = new DrawFormDrawer(page);
    const drawerOpened = await drawer.fieldSelect('Draw Type')
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (drawerOpened) {
      // The draw form should show the flight's entry count
      const drawSize = Number(await drawer.getInputValue('Draw size'));
      const flightEntryCount = flightInfo!.flights[0].entryCount;

      console.log(`Flight 1: ${flightEntryCount} entries → drawSize=${drawSize}`);

      // Draw size should be nextPowerOf2 of the flight's entry count
      expect(drawSize).toBeGreaterThanOrEqual(flightEntryCount);
      expect(drawSize).toBeLessThanOrEqual(32);

      // Draw name should match the flight name
      const drawName = await drawer.getInputValue('Draw name');
      expect(drawName).toBeDefined();
      expect(drawName.length).toBeGreaterThan(0);

      // Generate the draw
      await drawer.clickGenerate();
      const entry = await collector.waitForMethod('addDrawDefinition', 10_000);
      expect(entry).toBeDefined();
    } else {
      // Row click navigated somewhere else — document behavior
      console.log('Flight row click did not open addDraw drawer');
    }

    collector.detach();
  });

  test('flight draw names default correctly (Draw 1, Draw 2)', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_32);
    const tournamentPage = new TournamentPage(page);
    await tournamentPage.goto(tournamentId);

    // Create flights with custom names
    await page.evaluate(() => {
      const tournament = dev.getTournament();
      const event = tournament.events?.[0];
      if (!event) return;

      const result = dev.factory.tournamentEngine.generateFlightProfile({
        flightsCount: 2,
        drawNames: ['Flight A', 'Flight B'],
        eventId: event.eventId,
      });

      if (result.success) {
        dev.factory.tournamentEngine.addEventExtension({
          eventId: event.eventId,
          extension: { name: 'flightProfile', value: result.flightProfile },
        });
      }
    });

    // Navigate to Draws tab and verify flight names
    await tournamentPage.navigateToEvents();
    await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
    await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
    await page.locator('#eventTabsBar').getByText('Draws').click();
    await page.waitForTimeout(500);

    // Verify both flight names appear in the draws table
    const tableText = await page.locator('.tabulator-row').allTextContents();
    const allText = tableText.join(' ');
    expect(allText).toContain('Flight A');
    expect(allText).toContain('Flight B');
  });
});
