import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { getTournamentRecord, seedTournament } from '../helpers/seed';
import { generateFromTopology } from '../helpers/topologyGenerate';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Journey 214 — the draw builder for a flight (CA 2026-11-17). A flight is a reserved drawId with its own entries; the
 * builder works on those: its defaults, its ledger, and the draw it generates (under the flight's drawId). It worked on
 * the whole event's entries.
 */
const PROFILE = {
  tournamentName: 'Topology Flight E2E',
  tournamentAttributes: { tournamentId: 'e2e-topology-flight-001' },
  participantsProfile: { participantsCount: 32 },
  eventProfiles: [{ eventName: 'Open Singles', participantsProfile: { participantsCount: 32 } }],
};

/** Two flights of 16; returns the event and the first flight. */
async function seedFlights(page: Page) {
  const tournamentId = await seedTournament(page, PROFILE);
  const seeded = await page.evaluate(async () => {
    const eventId = dev.getTournament().events[0].eventId;
    const engine = dev.factory.tournamentEngine;
    const { flightProfile } = engine.generateFlightProfile({ flightsCount: 2, eventId });
    engine.attachFlightProfile({ eventId, flightProfile, deleteExisting: true });
    await dev.load(engine.getTournament().tournamentRecord);
    const [flight] = engine.getFlightProfile({ eventId }).flightProfile.flights;
    return { eventId, drawId: flight.drawId, drawName: flight.drawName, entries: flight.drawEntries.length };
  });
  return { tournamentId, ...seeded };
}

test.describe('Topology — a flight', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test("works on the flight's entries, and generates the flight's draw", async ({ page }) => {
    const { tournamentId, eventId, drawId, drawName, entries } = await seedFlights(page);
    expect(entries).toBe(16);
    await page.goto(`/#/tournament/${tournamentId}/topology/${eventId}/${drawId}`);
    const topology = page.locator('#tmxTopology');
    const card = topology.locator('.tb-card').first();
    await expect(card).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('#eventTabsBar .event-tab-btn', { hasText: `Draw builder · ${drawName}` })).toBeVisible();
    // the flight's 16, not the event's 32
    await expect(card.locator('.tb-card-size')).toHaveText('×16');
    await expect(topology.locator('.tb-footer-hint .tb-ledger-chip')).toHaveText(['16 DA']);

    await generateFromTopology(page, topology);
    await expect
      .poll(async () => ((await getTournamentRecord(page)) as any).events[0].drawDefinitions?.length ?? 0, {
        timeout: 10_000,
      })
      .toBe(1);
    const drawDefinition = ((await getTournamentRecord(page)) as any).events[0].drawDefinitions[0];
    expect(drawDefinition.drawId).toBe(drawId);
    expect(drawDefinition.drawName).toBe(drawName);
    expect(drawDefinition.entries).toHaveLength(16);
  });

  test("the flight's Add Draw drawer hands the flight to the builder", async ({ page }) => {
    const { tournamentId, eventId, drawName } = await seedFlights(page);
    await page.goto(`/#/tournament/${tournamentId}/event/${eventId}/draws`);
    await page.locator('.chc-dc-card', { hasText: drawName }).click();
    const drawer = page.locator('#tmxDrawer');
    await expect(drawer.locator('#generateDraw')).toBeVisible({ timeout: 10_000 });
    await drawer.getByRole('button', { name: /Open in draw builder/ }).click();

    const card = page.locator('#tmxTopology .tb-card').first();
    await expect(card.locator('.tb-card-size')).toHaveText('×16', { timeout: 10_000 });
    await expect(page.locator('#eventTabsBar .event-tab-btn', { hasText: `Draw builder · ${drawName}` })).toBeVisible();
  });
});
