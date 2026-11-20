import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';
import { test, expect } from '@playwright/test';
import { join } from 'node:path';

test.use({ timezoneId: 'America/New_York' });
for (const theme of ['light', 'dark'] as const)
  test(`CMX shared catalog in TMX: ${theme}`, async ({ page }, testInfo) => {
    await page.clock.setFixedTime(new Date('2026-11-20T15:00:00Z'));
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    const id = await page.evaluate(async () => {
      localStorage.clear();
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 7,
        setState: true,
        tournamentName: 'Synthetic catalog regression',
        tournamentAttributes: {
          tournamentId: 'cmx-catalog-regression',
          startDate: '2026-11-20',
          endDate: '2026-11-20',
        },
        participantsProfile: { scaledParticipantsCount: 16 },
        drawProfiles: [{ eventName: 'Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
        venueProfiles: [{ venueName: 'Example venue', courtsCount: 2 }],
      });
      const matchUp = dev.factory.tournamentEngine
        .allTournamentMatchUps({})
        .matchUps.find((m: any) => m.roundNumber === 1);
      const result = dev.factory.tournamentEngine.addMatchUpScheduleItems({
        drawId: matchUp.drawId,
        matchUpId: matchUp.matchUpId,
        schedule: { scheduledDate: '2026-11-20', scheduledTime: '10:30' },
      });
      if (result.error) throw new Error(result.error);
      await dev.tmx2db.addTournament(dev.factory.tournamentEngine.getTournament().tournamentRecord);
      return tournamentRecord.tournamentId;
    });
    const tournament = new TournamentPage(page);
    await tournament.goto(id);
    await tournament.navigateToScheduling();
    await page.evaluate((mode) => {
      document.documentElement.dataset.theme = mode;
    }, theme);
    const variant = process.env.CMX_CATALOG_VARIANT ?? 'candidate';
    for (const tab of ['unscheduled', 'scheduled']) {
      await page.locator(`[data-sidebar-tab="${tab}"]`).click();
      const panel = page.locator(tab === 'unscheduled' ? '[data-panel="catalog"]' : '[data-sidebar-panel="scheduled"]');
      await expect(panel.locator('.spl-matchup-card').first()).toBeVisible();
      const filename = `cmx-tmx-catalog-${variant}-${theme}-${tab}.png`;
      await panel.screenshot({
        path: process.env.CMX_CATALOG_EVIDENCE_DIR
          ? join(process.env.CMX_CATALOG_EVIDENCE_DIR, filename)
          : testInfo.outputPath(filename),
        animations: 'disabled',
      });
    }
    await page.locator('[data-sidebar-tab="unscheduled"]').click();
    const card = page.locator('[data-panel="catalog"] .spl-matchup-card[draggable="true"]').first();
    const matchUpId = await card.getAttribute('data-matchup-id');
    const target = page.locator('.spl-grid-slot [data-court-id][data-court-order="1"]').first();
    await expect(target).toBeVisible();
    const courtId = await target.getAttribute('data-court-id');
    await card.dragTo(target);
    await expect
      .poll(() =>
        page.evaluate(
          (matchUpId) => dev.factory.tournamentEngine.findMatchUp({ matchUpId }).matchUp?.schedule?.courtId,
          matchUpId,
        ),
      )
      .toBe(courtId);
  });
