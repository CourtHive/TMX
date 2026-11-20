import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { getTournamentRecord, seedTournament } from '../helpers/seed';
import { generateFromTopology } from '../helpers/topologyGenerate';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Journey 216 — one design for the other flights (topology builder 3B, CA 2026-11-18). A flight's design becomes the
 * builder draft of each other flight without a draw, sized to its own entries; nothing is generated until the director
 * opens a flight and generates it, and each draw is independent once made. The event is generated with mocksEngine.
 */
const PROFILE = {
  tournamentName: 'Topology Flight Design E2E',
  tournamentAttributes: { tournamentId: 'e2e-topology-flight-design' },
  participantsProfile: { participantsCount: 36 },
  eventProfiles: [{ eventName: 'Open Singles', participantsProfile: { participantsCount: 36 } }],
};
const SHARE = '#topologyFlightsDesign';

/** Three flights of 12; returns the event and its flights. */
async function seedFlights(page: Page) {
  const tournamentId = await seedTournament(page, PROFILE);
  const seeded = await page.evaluate(async () => {
    const eventId = dev.getTournament().events[0].eventId;
    const engine = dev.factory.tournamentEngine;
    const { flightProfile } = engine.generateFlightProfile({ flightsCount: 3, eventId });
    engine.attachFlightProfile({ eventId, flightProfile, deleteExisting: true });
    await dev.load(engine.getTournament().tournamentRecord);
    const flights = engine.getFlightProfile({ eventId }).flightProfile.flights;
    return { eventId, flights: flights.map((f: any) => ({ drawId: f.drawId, drawName: f.drawName })) };
  });
  return { tournamentId, ...seeded };
}

test.describe('Topology — one design for the other flights', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test("a flight's design is the other flights' draft, sized to their entries, made only when generated", async ({
    page,
  }) => {
    const { tournamentId, eventId, flights } = await seedFlights(page);
    const [first, second, third] = flights;

    // the first flight's design: its Main as a feed-in (the default is an elimination of 16 for 12)
    await page.goto(`/#/tournament/${tournamentId}/topology/${eventId}/${first.drawId}`);
    const topology = page.locator('#tmxTopology');
    const main = topology.locator('.tb-card').first();
    await expect(main.locator('.tb-card-size')).toHaveText('×16', { timeout: 10_000 });
    await main.locator('.tb-feed-toggle').click();
    await expect(main.locator('.tb-feed-toggle')).toHaveAttribute('aria-pressed', 'true');

    await page.locator(SHARE).click();
    await expect(page.locator('.notification', { hasText: '2 flights have this design' })).toBeVisible();
    // nothing is generated
    expect(((await getTournamentRecord(page)) as any).events[0].drawDefinitions ?? []).toHaveLength(0);

    // the draws view says which flights hold a draft
    await page.goto(`/#/tournament/${tournamentId}/event/${eventId}/draws`);
    for (const flight of [second, third])
      await expect(page.locator('.chc-dc-card', { hasText: flight.drawName })).toContainText('Draft in the builder');

    // a flight's draft opens in its builder, sized to its own 12, and generates its own draw
    await page.locator('.chc-dc-card', { hasText: second.drawName }).click();
    await expect(
      page.locator('#eventTabsBar .event-tab-btn', { hasText: `Draw builder · ${second.drawName}` }),
    ).toBeVisible();
    const draftMain = topology.locator('.tb-card').first();
    await expect(draftMain.locator('.tb-card-size')).toHaveText('×12', { timeout: 10_000 });
    await expect(draftMain.locator('.tb-feed-toggle')).toHaveAttribute('aria-pressed', 'true');
    await generateFromTopology(page, topology);
    await expect
      .poll(async () => ((await getTournamentRecord(page)) as any).events[0].drawDefinitions?.length ?? 0, {
        timeout: 10_000,
      })
      .toBe(1);
    const drawDefinition = ((await getTournamentRecord(page)) as any).events[0].drawDefinitions[0];
    expect(drawDefinition.drawId).toBe(second.drawId);
    expect(drawDefinition.drawName).toBe(second.drawName);
    expect(drawDefinition.entries).toHaveLength(12);
  });

  test('a second use asks before it replaces the drafts the flights hold', async ({ page }) => {
    const { tournamentId, eventId, flights } = await seedFlights(page);
    await page.goto(`/#/tournament/${tournamentId}/topology/${eventId}/${flights[0].drawId}`);
    await expect(page.locator('#tmxTopology .tb-card').first()).toBeVisible({ timeout: 10_000 });
    await page.locator(SHARE).click();
    await page.locator(SHARE).click();
    await expect(page.getByText('2 flights already have a draft. Replace them with this design?')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  });
});
