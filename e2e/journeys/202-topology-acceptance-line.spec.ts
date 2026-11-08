import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { getTournamentRecord, seedTournament } from '../helpers/seed';

/**
 * Journey 202 — the topology Fit mode's acceptance line (CA 2026-11-08): a cut through the event's ranked MAIN
 * entries. Moving it previews the fit; Generate applies the entry changes in the same request that adds the draw.
 */
const PROFILE = {
  tournamentName: 'Topology Acceptance E2E',
  tournamentAttributes: { tournamentId: 'e2e-topology-acceptance-001' },
  participantsProfile: { participantsCount: 26 },
  eventProfiles: [{ eventName: 'Open Singles', participantsProfile: { participantsCount: 26 } }],
};

const FIT = 'button.tb-mode-toggle[data-mode="fit"]';

test.describe('Topology — the acceptance line', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('cut at 16: the 16 fits, and Generate makes ten alternates and the draw together', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE);
    const record: any = await getTournamentRecord(page);
    const event = record.events[0];

    await page.goto(`/#/tournament/${tournamentId}/topology/${event.eventId}`);
    const topology = page.locator('#tmxTopology');
    await expect(topology.locator(FIT)).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });

    await topology.getByRole('button', { name: 'Add Structure' }).click();
    await page
      .locator('.dropdown-item', { hasText: /^Main$/ })
      .first()
      .click();
    const main = topology.locator('.tb-card').filter({ has: page.locator('.tb-fit') });
    // 26 for 16 positions: ten have no place
    await main.locator('.tb-fit-stepper[data-lever="size"] .tb-fit-step[data-direction="down"]').click();
    await expect(main.locator('.tb-fit-status')).toHaveAttribute('data-status', 'OVER', { timeout: 10_000 });

    // the line: 26 ranked entries, all accepted today
    await topology.locator('.tb-acceptance-toggle').click();
    const rows = topology.locator('.tb-acceptance-row');
    await expect(rows).toHaveCount(26);
    const line = topology.locator('.tb-acceptance-line');
    await expect(line).toHaveAttribute('aria-valuenow', '26');

    // accept down to the 16th: the main draw fits, ten wait as alternates — nothing written yet
    await rows.nth(15).click();
    await expect(line).toHaveAttribute('aria-valuenow', '16');
    await expect(main.locator('.tb-fit-status')).toHaveAttribute('data-status', 'FITS');
    await expect(main.locator('.tb-fit-text')).toHaveText('16 entered');
    await expect(topology.locator('.tb-acceptance-pending')).toContainText('10 DA → ALT');
    await expect(topology.locator('.tb-footer-hint')).toHaveText('Main  16 DA · 10 ALT');
    const before: any = await getTournamentRecord(page);
    expect(before.events[0].entries.filter((e: any) => e.entryStatus === 'ALTERNATE')).toHaveLength(0);
    await page.screenshot({ path: test.info().outputPath('acceptance-line.png') });

    // Generate: the statuses and the draw land together
    await topology.getByRole('button', { name: 'Generate Draw' }).click();
    await expect
      .poll(async () => ((await getTournamentRecord(page)) as any).events[0].drawDefinitions?.length ?? 0, {
        timeout: 10_000,
      })
      .toBe(1);
    const after: any = await getTournamentRecord(page);
    const alternates = after.events[0].entries.filter((e: any) => e.entryStatus === 'ALTERNATE');
    expect(alternates).toHaveLength(10);
    const drawEntries = after.events[0].drawDefinitions[0].entries.filter(
      (e: any) => e.entryStatus === 'DIRECT_ACCEPTANCE',
    );
    expect(drawEntries).toHaveLength(16);
  });
});
