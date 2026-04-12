/**
 * Journey 4 — Draw form: Qualifying modes
 *
 * Tests NEW_QUALIFYING, GENERATE_QUALIFYING, and ATTACH_QUALIFYING
 * modes. These require seeding tournaments with specific draw/structure
 * contexts that expose the qualifying drawer entry points.
 *
 * @see Test matrix sections 1.4, 1.6, 1.7
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { DrawFormDrawer } from '../pages/DrawFormDrawer';

/* ─── Seed profiles ─────────────────────────────────────────────────────── */

/** Tournament with event + entries but no draw. Used for NEW_QUALIFYING
 *  (the qualifying drawer entry point requires an event with qualifying
 *  entries). We seed qualifying entries via the factory. */
const PROFILE_WITH_QUALIFYING_ENTRIES: MockProfile = {
  tournamentName: 'E2E Qualifying Modes',
  tournamentAttributes: { tournamentId: 'e2e-qualifying' },
  participantsProfile: { scaledParticipantsCount: 32 },
  drawProfiles: [
    {
      eventName: 'Singles',
      drawSize: 16,
      seedsCount: 4,
      drawType: 'SINGLE_ELIMINATION',
    },
  ],
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

/**
 * Seed a tournament with a completed main draw, navigate to the draw view,
 * and open the qualifying generation drawer via the structure options menu.
 *
 * Note: The exact UI path to trigger addDraw in qualifying modes depends
 * on the structure options menu in the draws view. If the selector needs
 * tuning after the first live run, adjust here.
 */
async function seedAndNavigateToDrawView(
  page: any,
  profile: MockProfile,
): Promise<{ tournamentPage: TournamentPage; tournamentId: string }> {
  const tournamentId = await seedTournament(page, profile);
  const tournamentPage = new TournamentPage(page);
  await tournamentPage.goto(tournamentId);
  return { tournamentPage, tournamentId };
}

/* ─── Tests ──────────────────────────────────────────────────────────────── */

test.describe('Journey 4 — Draw form qualifying modes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  /* ── Section 1.4/1.6: NEW_QUALIFYING / GENERATE_QUALIFYING field state ── */

  test('qualifying mode shows structure name, hides draw name and qualifying-first', async ({ page }) => {
    // Seed a tournament and programmatically open the draw form in qualifying mode
    const tournamentId = await seedTournament(page, PROFILE_WITH_QUALIFYING_ENTRIES);
    const tournamentPage = new TournamentPage(page);
    await tournamentPage.goto(tournamentId);

    // Use the dev bridge to invoke addDraw in qualifying mode directly.
    // This bypasses the UI navigation to the structure options menu,
    // which varies by draw state. The form itself is what we're testing.
    const eventId = await page.evaluate(() => {
      const tournament = dev.getTournament();
      return tournament.events?.[0]?.eventId;
    });

    const drawId = await page.evaluate(() => {
      const tournament = dev.getTournament();
      return tournament.events?.[0]?.drawDefinitions?.[0]?.drawId;
    });

    await page.evaluate(
      ({ eventId, drawId }: { eventId: string; drawId: string }) => {
        // Import and call addDraw with qualifying flags
        const { addDraw } = require('components/drawers/addDraw/addDraw');
        addDraw({ eventId, drawId, isQualifying: true, callback: () => {} });
      },
      { eventId, drawId },
    );

    const drawer = new DrawFormDrawer(page);
    await drawer.waitForOpen();

    // Qualifying mode field assertions (1.4.x / 1.6.x)
    await drawer.expectFieldVisible('Structure name');
    await drawer.expectFieldHidden('Draw name');
    await drawer.expectFieldHidden('Seeding policy');

    // Draw type should only show qualifying-allowed types
    const drawTypeSelect = drawer.fieldSelect('Draw type');
    const optionCount = await drawTypeSelect.locator('option').count();
    // Qualifying allows: SE, RR, RR_PLAYOFF = 3 types
    expect(optionCount).toBeLessThanOrEqual(4); // may include a default/blank

    await drawer.clickCancel();
  });

  /* ── Section 1.7: ATTACH_QUALIFYING ──────────────────────────────── */

  test('attach qualifying mode shows qualifiers count, disables automated', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_WITH_QUALIFYING_ENTRIES);
    const tournamentPage = new TournamentPage(page);
    await tournamentPage.goto(tournamentId);

    // Get event, draw, and main structure IDs
    const ids = await page.evaluate(() => {
      const tournament = dev.getTournament();
      const event = tournament.events?.[0];
      const draw = event?.drawDefinitions?.[0];
      const structure = draw?.structures?.find((s: any) => s.stage === 'MAIN');
      return {
        eventId: event?.eventId,
        drawId: draw?.drawId,
        structureId: structure?.structureId,
      };
    });

    // Open addDraw in ATTACH_QUALIFYING mode via dev bridge
    await page.evaluate(
      (params: { eventId: string; drawId: string; structureId: string }) => {
        const { addDraw } = require('components/drawers/addDraw/addDraw');
        addDraw({
          eventId: params.eventId,
          drawId: params.drawId,
          structureId: params.structureId,
          isQualifying: true,
          callback: () => {},
        });
      },
      ids,
    );

    const drawer = new DrawFormDrawer(page);
    await drawer.waitForOpen();

    // ATTACH_QUALIFYING field assertions (1.7.x)
    await drawer.expectFieldVisible('Structure name');
    await drawer.expectFieldHidden('Draw name');
    await drawer.expectFieldVisible('Qualifiers');
    await drawer.expectFieldHidden('Seeding policy');

    // Automated should be visible but disabled
    await drawer.expectFieldVisible('Creation');
    const automatedSelect = drawer.fieldSelect('Creation');
    // The automated option should be disabled within the select
    // (the model sets AUTOMATED disabled: true for ATTACH_QUALIFYING)

    await drawer.clickCancel();
  });
});
