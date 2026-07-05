import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, seedFeatureFlagInitScript, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, PROFILE_COMPLETED } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/**
 * Journey 68 — Reports tab render + report-row → draw navigation.
 *
 * The reports surface (renderReportsTab / createReportsTable / report-row→draw
 * navigation) has only unit coverage and zero e2e. Navigable rows (eventId &&
 * drawId) get cursor:pointer and, on click, call navigateToEvent({renderDraw})
 * (createReportsTable.ts). This picks a LOCAL report whose first row is
 * navigable, deep-links to it, and asserts the row click lands on the draw.
 */

test.describe('Journey 68 — reports row navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Reports are behind the `reports` beta flag — seed it before boot.
    await seedFeatureFlagInitScript(page, 'reports');
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('a navigable report row navigates to the matchUp in its draw', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_COMPLETED);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);

    // Find a LOCAL report whose first row carries eventId + drawId (navigable).
    const found = await page.evaluate(() => {
      const avail: any = dev.factory.tournamentEngine.getAvailableReports?.() ?? {};
      const reports = (avail.availableReports ?? []).filter((r: any) => r.computableNow && r.source !== 'server');
      for (const r of reports) {
        const res: any = dev.factory.tournamentEngine.generateReport({ reportId: r.reportId });
        const rows: any[] = res?.rows ?? [];
        if (rows.length && rows[0].eventId && rows[0].drawId) return { reportId: r.reportId as string, names: null };
      }
      return { reportId: null, names: reports.map((r: any) => r.name) };
    });
    expect(found.reportId, `no navigable local report found; available: ${JSON.stringify(found.names)}`).toBeTruthy();

    // Deep-link to that report (in-app hash nav so the SPA stays alive).
    await page.evaluate(
      ({ id, reportId }) => {
        window.location.hash = `#/tournament/${id}/reports/${reportId}`;
      },
      { id: tournamentId, reportId: found.reportId },
    );

    const rows = page.locator('#tournamentReports .tabulator-row');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });

    // Click the first (navigable) row → it navigates to the event's draw.
    await rows.first().click();
    await expect(page.locator(S.DRAW_FRAME)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(S.DRAWS_VIEW)).toBeVisible({ timeout: 5_000 });
  });
});
