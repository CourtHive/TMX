/**
 * Journey 45 — Generate qualifying banner appears in the recovery state
 *
 * When the main bracket has reserved qualifier slots but no QUALIFYING
 * structure exists in drawDefinition.structures (e.g. placeholder was
 * removed), a recovery banner is rendered above the bracket with a
 * one-click "Generate qualifying" affordance.
 *
 * The banner must NOT appear when:
 *   - A qualifying placeholder or real qualifying structure exists
 *   - Main has no qualifier-marked positionAssignments
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady, ensureDrawsTableMode } from '../helpers/dev-bridge';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

const PROFILE_WITH_QUALIFIER_SLOTS: MockProfile = {
  tournamentName: 'E2E Banner — qualifier slots',
  tournamentAttributes: { tournamentId: 'e2e-banner-slots' },
  participantsProfile: { scaledParticipantsCount: 80 },
  drawProfiles: [
    {
      eventName: 'Singles',
      drawSize: 32,
      drawType: 'SINGLE_ELIMINATION',
      qualifyingPlaceholder: true,
      qualifiersCount: 8,
      participantsCount: 24,
    },
  ],
};

const PROFILE_NO_QUALIFIERS: MockProfile = {
  tournamentName: 'E2E Banner — no qualifiers',
  tournamentAttributes: { tournamentId: 'e2e-banner-no-q' },
  participantsProfile: { scaledParticipantsCount: 80 },
  drawProfiles: [
    {
      eventName: 'Singles',
      drawSize: 32,
      drawType: 'SINGLE_ELIMINATION',
      participantsCount: 32,
    },
  ],
};

async function stripQualifyingPlaceholder(page: any, drawId: string): Promise<void> {
  await page.evaluate(
    async ({ drawId }: { drawId: string }) => {
      const tr = (dev as any).getTournament();
      const dd = tr.events[0].drawDefinitions.find((d: any) => d.drawId === drawId);
      const qualifyingIds = new Set(
        dd.structures.filter((s: any) => s.stage === 'QUALIFYING').map((s: any) => s.structureId),
      );
      dd.structures = dd.structures.filter((s: any) => !qualifyingIds.has(s.structureId));
      dd.links = (dd.links ?? []).filter(
        (l: any) => !qualifyingIds.has(l.source?.structureId) && !qualifyingIds.has(l.target?.structureId),
      );
      const engine = (dev as any).factory.tournamentEngine;
      engine.setState(tr);
      // Write directly to IndexedDB and await it so the subsequent page.reload
      // reads the stripped state — dev.load is fire-and-forget.
      const tmx2db = (dev as any).tmx2db;
      if (tmx2db?.addTournament) {
        await tmx2db.addTournament(tr);
      }
      (dev as any).load(tr);
    },
    { drawId },
  );
}

async function getFirstDrawId(page: any): Promise<string> {
  return page.evaluate(() => (dev as any).getTournament().events[0].drawDefinitions[0].drawId as string);
}

async function navigateToDrawView(page: any, tournamentId: string): Promise<void> {
  const tournamentPage = new TournamentPage(page);
  await tournamentPage.goto(tournamentId);
  await tournamentPage.navigateToEvents();
  await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
  await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
  await page.locator('#eventTabsBar').getByText('Draws').click();
  await page.locator('.tabulator-row').first().waitFor({ state: 'visible', timeout: 5_000 });
  await page.locator('.tabulator-row').first().click();
  await page.locator(S.DRAW_CONTROL).waitFor({ state: 'visible', timeout: 10_000 });
}

test.describe('Journey 45 — Generate qualifying recovery banner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await ensureDrawsTableMode(page);
  });

  test('shows when main has qualifier slots but no QUALIFYING structure', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_WITH_QUALIFIER_SLOTS);
    const drawId = await getFirstDrawId(page);
    await stripQualifyingPlaceholder(page, drawId);
    // Hard reload so the routed view re-renders against the stripped state.
    await page.reload();
    await waitForAppReady(page);
    await initDevBridge(page);
    await navigateToDrawView(page, tournamentId);

    const banner = page.locator('#generateQualifyingBanner');
    await banner.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(banner).toContainText(/qualifier position(s)? reserved/);
    await expect(banner.getByRole('button', { name: /Generate qualifying/i })).toBeVisible();
  });

  test('hidden when a qualifying placeholder exists', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_WITH_QUALIFIER_SLOTS);
    await navigateToDrawView(page, tournamentId);

    await page.locator(S.DRAWS_VIEW).waitFor({ state: 'visible', timeout: 5_000 });
    // Give the bracket render a beat to settle so a banner — if it were
    // going to appear — would have rendered by now.
    await page.waitForTimeout(250);
    await expect(page.locator('#generateQualifyingBanner')).toHaveCount(0);
  });

  test('hidden when main has no qualifier slots', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_NO_QUALIFIERS);
    await navigateToDrawView(page, tournamentId);

    await page.locator(S.DRAWS_VIEW).waitFor({ state: 'visible', timeout: 5_000 });
    await page.waitForTimeout(250);
    await expect(page.locator('#generateQualifyingBanner')).toHaveCount(0);
  });
});
