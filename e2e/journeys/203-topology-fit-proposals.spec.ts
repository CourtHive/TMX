import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { getTournamentRecord, seedTournament } from '../helpers/seed';
import { test, expect } from '@playwright/test';

/**
 * Journey 202 — the topology Fit mode's acceptance line (CA 2026-11-08): a cut through the event's ranked MAIN
 * entries. Moving it previews the fit; Generate applies the entry changes in the same request that adds the draw.
 */
const PROFILE = {
  tournamentName: 'Topology Fit Proposals E2E',
  tournamentAttributes: { tournamentId: 'e2e-topology-proposals-001' },
  participantsProfile: { participantsCount: 40 },
  eventProfiles: [{ eventName: 'Open Singles', participantsProfile: { participantsCount: 40 } }],
};

const FIT = 'button.tb-mode-toggle[data-mode="fit"]';

test.describe('Topology — factory Fit proposals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('Cut previews eight alternates and Generate applies the proposal with the draw', async ({ page }) => {
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
    await expect(main.locator('.tb-fit-status')).toHaveAttribute('data-status', 'OVER', { timeout: 10_000 });
    await topology.locator('.tb-proposals-toggle').click();
    await expect(topology.locator('[data-kind="Grow"]')).toContainText('24 extra BYEs');
    await page.evaluate(async () => {
      const modulePath = '/src/services/theme/themeService.ts';
      (await import(modulePath)).applyTheme('light');
    });
    await page.screenshot({ path: test.info().outputPath('fit-options-light.png') });
    await page.evaluate(async () => {
      const modulePath = '/src/services/theme/themeService.ts';
      (await import(modulePath)).applyTheme('dark');
    });
    await page.screenshot({ path: test.info().outputPath('fit-options-dark.png') });
    await topology.locator('[data-kind="Cut"]').click();
    await expect(main.locator('.tb-fit-status')).toHaveAttribute('data-status', 'FITS');
    await expect(topology.locator('.tb-acceptance-pending[data-stage="MAIN"]')).toContainText('8 DA → ALT');
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
    expect(alternates).toHaveLength(8);
    const drawEntries = after.events[0].drawDefinitions[0].entries.filter(
      (e: any) => e.entryStatus === 'DIRECT_ACCEPTANCE',
    );
    expect(drawEntries).toHaveLength(32);
  });
});
