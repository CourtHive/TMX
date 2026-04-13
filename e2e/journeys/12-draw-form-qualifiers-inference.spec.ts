/**
 * Journey 12 — Draw form: Qualifiers count inference
 *
 * Tests the NEW_MAIN model's qualifiers count default when qualifying
 * entries exist on the event. This is new Phase B behavior.
 *
 * @see Test matrix section 9
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { DrawFormDrawer } from '../pages/DrawFormDrawer';

test.describe('Journey 12 — Qualifiers count inference', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('9.1 — qualifiers count defaults to gap when qualifying entries exist', async ({ page }) => {
    // Seed tournament, then modify entries: change 4 main to ALTERNATE
    // and reassign them as QUALIFYING stage
    const profile: MockProfile = {
      tournamentName: 'E2E Qual Inference',
      tournamentAttributes: { tournamentId: 'e2e-qual-inf' },
      participantsProfile: { scaledParticipantsCount: 32 },
      drawProfiles: [{ eventName: 'Singles', drawSize: 16, generate: false }],
    };
    const tournamentId = await seedTournament(page, profile);
    const tournamentPage = new TournamentPage(page);
    await tournamentPage.goto(tournamentId);

    // Change 4 main entries to ALTERNATE, then add 8 qualifying entries
    // by changing entryStage on some existing entries
    const addResult = await page.evaluate(() => {
      const tournament = dev.getTournament();
      const event = tournament.events?.[0];
      if (!event?.entries) return { success: false };

      // Change 3 main entries to QUALIFYING stage (keeping DA status).
      // This gives 13 main DA + 3 qualifying DA.
      // SE drawSize = nextPowerOf2(13) = 16, gap = 16-13 = 3.
      // With qualifying entries present, qualifiers should default to 3.
      let qualChanged = 0;
      for (const entry of event.entries) {
        if (qualChanged < 3 && entry.entryStatus === 'DIRECT_ACCEPTANCE' && (!entry.entryStage || entry.entryStage === 'MAIN')) {
          entry.entryStage = 'QUALIFYING';
          qualChanged++;
        }
      }

      dev.factory.tournamentEngine.setState(tournament);

      const mainAccepted = event.entries.filter(
        (e: any) => e.entryStatus === 'DIRECT_ACCEPTANCE' && (!e.entryStage || e.entryStage === 'MAIN'),
      );
      const qual = event.entries.filter((e: any) => e.entryStage === 'QUALIFYING');

      return { success: true, mainEntries: mainAccepted.length, qualifyingEntries: qual.length };
    });

    console.log('9.1 addResult:', JSON.stringify(addResult));
    expect(addResult.success).toBe(true);
    expect(addResult.mainEntries).toBe(13);
    expect(addResult.qualifyingEntries).toBe(3);

    // Open the draw form
    await tournamentPage.navigateToEvents();
    await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
    await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
    await page.getByRole('button', { name: 'Add draw' }).click();
    const drawer = new DrawFormDrawer(page);
    await drawer.waitForOpen();

    // The model should infer a non-zero qualifiersCount when qualifying
    // entries exist and there's a power-of-2 gap.
    const drawSize = Number(await drawer.getInputValue('Draw size'));
    const mainEntries = addResult.mainEntries;
    const expectedGap = drawSize - mainEntries;

    console.log(`9.1: drawSize=${drawSize}, mainEntries=${mainEntries}, gap=${expectedGap}`);
    expect(drawSize).toBe(16); // nextPowerOf2(13) = 16

    const qualifiers = Number(await drawer.getInputValue('Qualifiers'));
    // Model infers qualifiersCount = max(0, 16 - 13) = 3
    expect(qualifiers).toBe(3);

    await drawer.clickCancel();
  });

  test('9.2 — qualifiers count = 0 when entries fill draw exactly (no gap)', async ({ page }) => {
    const profile: MockProfile = {
      tournamentName: 'E2E No Gap',
      tournamentAttributes: { tournamentId: 'e2e-no-gap' },
      participantsProfile: { scaledParticipantsCount: 32 },
      drawProfiles: [{ eventName: 'Singles', drawSize: 16, generate: false }],
    };
    const tournamentId = await seedTournament(page, profile);
    const tournamentPage = new TournamentPage(page);
    await tournamentPage.goto(tournamentId);

    // Add qualifying entries
    await page.evaluate(() => {
      const tournament = dev.getTournament();
      const event = tournament.events?.[0];
      if (!event) return;
      const existingIds = new Set((event.entries || []).map((e: any) => e.participantId));
      const available = tournament.participants.filter((p: any) => !existingIds.has(p.participantId));
      const qualEntries = available.slice(0, 4).map((p: any) => ({
        participantId: p.participantId,
        entryStatus: 'DIRECT_ACCEPTANCE',
        entryStage: 'QUALIFYING',
      }));
      event.entries = [...(event.entries || []), ...qualEntries];
      dev.factory.tournamentEngine.setState(tournament);
    });

    // Open draw form: 16 main entries, drawSize=16, gap=0
    await tournamentPage.navigateToEvents();
    await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
    await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
    await page.getByRole('button', { name: 'Add draw' }).click();
    const drawer = new DrawFormDrawer(page);
    await drawer.waitForOpen();

    const drawSize = Number(await drawer.getInputValue('Draw size'));
    expect(drawSize).toBe(16);

    // Gap = 16 - 16 = 0, so qualifiers should be 0 even with qualifying entries
    const qualifiers = Number(await drawer.getInputValue('Qualifiers'));
    expect(qualifiers).toBe(0);

    await drawer.clickCancel();
  });

  test('9.4 — RR draw type: qualifiers = 0 (NON_POW2, drawSize=entries, no gap)', async ({ page }) => {
    const profile: MockProfile = {
      tournamentName: 'E2E RR No Gap',
      tournamentAttributes: { tournamentId: 'e2e-rr-nogap' },
      participantsProfile: { scaledParticipantsCount: 16 },
      drawProfiles: [{ eventName: 'Singles', drawSize: 8, participantsCount: 5, generate: false }],
    };
    const tournamentId = await seedTournament(page, profile);
    const tournamentPage = new TournamentPage(page);
    await tournamentPage.goto(tournamentId);

    // Add qualifying entries
    await page.evaluate(() => {
      const tournament = dev.getTournament();
      const event = tournament.events?.[0];
      if (!event) return;
      const existingIds = new Set((event.entries || []).map((e: any) => e.participantId));
      const available = tournament.participants.filter((p: any) => !existingIds.has(p.participantId));
      const qualEntries = available.slice(0, 3).map((p: any) => ({
        participantId: p.participantId,
        entryStatus: 'DIRECT_ACCEPTANCE',
        entryStage: 'QUALIFYING',
      }));
      event.entries = [...(event.entries || []), ...qualEntries];
      dev.factory.tournamentEngine.setState(tournament);
    });

    await tournamentPage.navigateToEvents();
    await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
    await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
    await page.getByRole('button', { name: 'Add draw' }).click();
    const drawer = new DrawFormDrawer(page);
    await drawer.waitForOpen();

    // Switch to RR: drawSize = raw = 5, gap = 0
    await drawer.selectDrawType('ROUND_ROBIN');
    const drawSize = Number(await drawer.getInputValue('Draw size'));
    expect(drawSize).toBe(5);

    // For NON_POW2 types, drawSize === entries → gap = 0 → qualifiers = 0
    // even though qualifying entries exist
    const qualifiers = Number(await drawer.getInputValue('Qualifiers'));
    expect(qualifiers).toBe(0);

    await drawer.clickCancel();
  });
});
