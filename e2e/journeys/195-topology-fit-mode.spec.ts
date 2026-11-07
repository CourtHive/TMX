import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { getTournamentRecord, seedTournament } from '../helpers/seed';

/**
 * The topology page's Fit mode (CA, 2026-11-08): how an event's entries would fill the draw a topology describes,
 * before it is made — the factory's getDrawFit on the draw the Generate button would make.
 */
const PROFILE = {
  tournamentName: 'Topology Fit E2E',
  tournamentAttributes: { tournamentId: 'e2e-topology-fit-001' },
  participantsProfile: { participantsCount: 26 },
  eventProfiles: [{ eventName: 'Open Singles', participantsProfile: { participantsCount: 26 } }],
};

const FIT = 'button.tb-mode-toggle[data-mode="fit"]';

test.describe('Topology — Fit mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('a new draw opens in Fit mode, and the size lever moves the fit', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE);
    const record: any = await getTournamentRecord(page);
    const event = record.events[0];
    expect(event.entries).toHaveLength(26);
    expect(event.drawDefinitions ?? []).toHaveLength(0);

    await page.goto(`/#/tournament/${tournamentId}/topology/${event.eventId}`);
    const topology = page.locator('#tmxTopology');
    await expect(topology.locator(FIT)).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });

    // a main structure to fit the entries to: the toolbar's default is a 32
    await topology.getByRole('button', { name: 'Add Structure' }).click();
    await page
      .locator('.dropdown-item', { hasText: /^Main$/ })
      .first()
      .click();

    const main = topology.locator('.tb-card').filter({ has: page.locator('.tb-fit') });
    await expect(main.locator('.tb-fit-status')).toHaveAttribute('data-status', 'SHORT', { timeout: 10_000 });
    await expect(main.locator('.tb-fit-text')).toHaveText('26 entered · 6 BYEs');
    await expect(topology.locator('.tb-footer-hint')).toHaveText('Main  26 DA');

    // half the size: 26 for 16 positions — ten have no place
    await main.locator('.tb-fit-stepper[data-lever="size"] .tb-fit-step[data-direction="down"]').click();
    await expect(main.locator('.tb-fit-status')).toHaveAttribute('data-status', 'OVER');
    await expect(main.locator('.tb-fit-text')).toHaveText('16 entered · 10 not placed');
    await expect(topology.locator('.tb-footer-hint')).toHaveText('Main  26 DA   |   10 not placed');

    // asking changed nothing: still no draw
    const after: any = await getTournamentRecord(page);
    expect(after.events[0].drawDefinitions ?? []).toHaveLength(0);
  });
});
