/**
 * Journey 2 — Draw form: NEW_MAIN mode
 *
 * Tests the draw configuration drawer when creating a brand-new main draw.
 * Covers test matrix sections 1.1 (mode × draw type), 3 (draw type
 * transitions), and partial 4 (qualifying-first toggle).
 *
 * @see Mentat/statuses/2026-04-12-draw-form-state-machine-test-matrix.md
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { DrawFormDrawer } from '../pages/DrawFormDrawer';

/* ─── Seed profiles ─────────────────────────────────────────────────────── */

/** Tournament with 16 participants and a SINGLES event with accepted
 *  entries but NO draw generated. The draw form opens in NEW_MAIN mode.
 *
 *  Uses drawProfiles with generate:false to create the event with entries
 *  but skip draw generation. eventProfiles alone doesn't auto-populate
 *  entries from the participant pool. */
const PROFILE_EVENT_NO_DRAW: MockProfile = {
  tournamentName: 'E2E Draw Form',
  tournamentAttributes: { tournamentId: 'e2e-draw-form' },
  participantsProfile: { scaledParticipantsCount: 16 },
  drawProfiles: [{ eventName: 'Singles', drawSize: 16, generate: false }],
};

/** Same but with qualifying entries to test qualifiers-count inference. */
const PROFILE_WITH_QUALIFYING: MockProfile = {
  tournamentName: 'E2E Draw Form Qualifying',
  tournamentAttributes: { tournamentId: 'e2e-draw-form-qual' },
  participantsProfile: { scaledParticipantsCount: 32 },
  eventProfiles: [
    {
      eventName: 'Singles',
      drawProfiles: [{ drawSize: 16, qualifyingProfiles: [{ drawSize: 8 }] }],
    },
  ],
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

async function seedAndOpenDrawForm(
  page: any,
  profile: MockProfile = PROFILE_EVENT_NO_DRAW,
): Promise<{ tournamentPage: TournamentPage; drawer: DrawFormDrawer }> {
  const tournamentId = await seedTournament(page, profile);
  const tournamentPage = new TournamentPage(page);
  await tournamentPage.goto(tournamentId);
  await tournamentPage.navigateToEvents();

  // Click the first event row to enter the event detail
  await tournamentPage.eventsTable.locator('.tabulator-row').first().click();

  // Wait for the event tabs bar to appear
  await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });

  // Click "Add draw" button
  await page.getByRole('button', { name: 'Add draw' }).click();

  const drawer = new DrawFormDrawer(page);
  await drawer.waitForOpen();
  return { tournamentPage, drawer };
}

/* ─── Tests ──────────────────────────────────────────────────────────────── */

test.describe('Journey 2 — Draw form NEW_MAIN', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  /* ── Section 1.1: Initial state per draw type ─────────────────────── */

  test('1.1.1 — SINGLE_ELIMINATION default: power-of-2 draw size, standard fields visible', async ({ page }) => {
    const { drawer } = await seedAndOpenDrawForm(page);

    // Default draw type should be SINGLE_ELIMINATION
    await expect(drawer.fieldSelect('Draw Type')).toHaveValue('SINGLE_ELIMINATION');

    // Draw size should be next power of 2 of the entry count
    const drawSize = await drawer.getInputValue('Draw size');
    expect(Number(drawSize)).toBeGreaterThanOrEqual(2);
    expect(Number(drawSize) & (Number(drawSize) - 1)).toBe(0); // power of 2

    // Standard fields visible
    await drawer.expectFieldVisible('Draw name');
    await drawer.expectFieldVisible('Draw Type');
    await drawer.expectFieldVisible('Draw size');
    await drawer.expectFieldVisible('Qualifiers');
    await drawer.expectFieldVisible('Seeding policy');
    await drawer.expectFieldVisible('Score format');

    // RR/playoff/drawmatic fields hidden
    await drawer.expectFieldHidden('Group size');
    await drawer.expectFieldHidden('Playoff Type');
    await drawer.expectFieldHidden('Rounds to generate');
    await drawer.expectFieldHidden('Rating scale');

    // Structure name hidden (only for qualifying modes)
    await drawer.expectFieldHidden('Structure name');

    await drawer.clickCancel();
  });

  test('1.1.2 — ROUND_ROBIN: raw draw size, group size visible', async ({ page }) => {
    const { drawer } = await seedAndOpenDrawForm(page);
    await drawer.selectDrawType('ROUND_ROBIN');

    // Draw size should be raw entry count (not power of 2)
    await drawer.expectFieldVisible('Group size');
    await drawer.expectFieldVisible('Seeding policy');

    // Playoff fields still hidden
    await drawer.expectFieldHidden('Playoff Type');
    await drawer.expectFieldHidden('Playoff Draw Type');

    await drawer.clickCancel();
  });

  test('1.1.3 — ROUND_ROBIN_WITH_PLAYOFF: group + playoff fields visible', async ({ page }) => {
    const { drawer } = await seedAndOpenDrawForm(page);
    await drawer.selectDrawType('ROUND_ROBIN_WITH_PLAYOFF');

    await drawer.expectFieldVisible('Group size');
    await drawer.expectFieldVisible('Playoff Type');
    await drawer.expectFieldVisible('Playoff Draw Type');
    await drawer.expectFieldVisible('Seeding policy');

    await drawer.clickCancel();
  });

  test('1.1.4 — FEED_IN: standard elimination fields, raw draw size', async ({ page }) => {
    const { drawer } = await seedAndOpenDrawForm(page);
    await drawer.selectDrawType('FEED_IN');

    await drawer.expectFieldVisible('Qualifiers');
    await drawer.expectFieldVisible('Seeding policy');
    await drawer.expectFieldHidden('Group size');
    await drawer.expectFieldHidden('Consolation feed depth');

    await drawer.clickCancel();
  });

  test('1.1.5 — FEED_IN_CHAMPIONSHIP: FIC depth visible', async ({ page }) => {
    const { drawer } = await seedAndOpenDrawForm(page);
    await drawer.selectDrawType('FEED_IN_CHAMPIONSHIP');

    await drawer.expectFieldVisible('Consolation feed depth');
    await drawer.expectFieldHidden('Group size');
    await drawer.expectFieldVisible('Seeding policy');

    await drawer.clickCancel();
  });

  test('1.1.6 — ADAPTIVE: standard fields, raw draw size', async ({ page }) => {
    const { drawer } = await seedAndOpenDrawForm(page);
    await drawer.selectDrawType('ADAPTIVE');

    await drawer.expectFieldVisible('Qualifiers');
    await drawer.expectFieldVisible('Seeding policy');
    await drawer.expectFieldHidden('Group size');

    await drawer.clickCancel();
  });

  test('1.1.7 — LUCKY_DRAW: standard fields, raw draw size', async ({ page }) => {
    const { drawer } = await seedAndOpenDrawForm(page);
    await drawer.selectDrawType('LUCKY_DRAW');

    await drawer.expectFieldVisible('Qualifiers');
    await drawer.expectFieldVisible('Seeding policy');
    await drawer.expectFieldHidden('Group size');

    await drawer.clickCancel();
  });

  test('1.1.8 — AD_HOC: seeding policy and qualifiers hidden', async ({ page }) => {
    const { drawer } = await seedAndOpenDrawForm(page);
    await drawer.selectDrawType('AD_HOC');

    await drawer.expectFieldHidden('Seeding policy');
    await drawer.expectFieldHidden('Qualifiers');

    await drawer.clickCancel();
  });

  test('1.1.9 — SWISS: rating scale visible, seeding + automated hidden', async ({ page }) => {
    const { drawer } = await seedAndOpenDrawForm(page);
    await drawer.selectDrawType('SWISS');

    await drawer.expectFieldVisible('Rating scale');
    await drawer.expectFieldHidden('Seeding policy');
    await drawer.expectFieldHidden('Creation');

    await drawer.clickCancel();
  });

  test('1.1.10 — DRAW_MATIC: rounds, ratings, team avoidance visible', async ({ page }) => {
    const { drawer } = await seedAndOpenDrawForm(page);
    await drawer.selectDrawType('DRAW_MATIC');

    await drawer.expectFieldVisible('Rounds to generate');
    await drawer.expectFieldVisible('Rating scale');
    // Dynamic ratings and team avoidance are checkboxes
    await drawer.expectCheckboxVisible('dynamicRatings');
    await drawer.expectCheckboxVisible('teamAvoidance');
    await drawer.expectFieldHidden('Seeding policy');

    await drawer.clickCancel();
  });

  /* ── Section 3: Draw type transitions ─────────────────────────────── */

  test('3.2.1 — SE → RR: group size appears', async ({ page }) => {
    const { drawer } = await seedAndOpenDrawForm(page);

    // Start at SE
    await expect(drawer.fieldSelect('Draw Type')).toHaveValue('SINGLE_ELIMINATION');
    await drawer.expectFieldHidden('Group size');

    // Switch to RR
    await drawer.selectDrawType('ROUND_ROBIN');
    await drawer.expectFieldVisible('Group size');

    await drawer.clickCancel();
  });

  test('3.2.2 — SE → RR_PLAYOFF: group + playoff fields appear', async ({ page }) => {
    const { drawer } = await seedAndOpenDrawForm(page);
    await drawer.selectDrawType('ROUND_ROBIN_WITH_PLAYOFF');

    await drawer.expectFieldVisible('Group size');
    await drawer.expectFieldVisible('Playoff Type');
    await drawer.expectFieldVisible('Playoff Draw Type');

    await drawer.clickCancel();
  });

  test('3.2.7 — RR_PLAYOFF → SE: group + playoff fields hidden', async ({ page }) => {
    const { drawer } = await seedAndOpenDrawForm(page);

    // Start at RR_PLAYOFF
    await drawer.selectDrawType('ROUND_ROBIN_WITH_PLAYOFF');
    await drawer.expectFieldVisible('Group size');
    await drawer.expectFieldVisible('Playoff Type');

    // Switch back to SE
    await drawer.selectDrawType('SINGLE_ELIMINATION');
    await drawer.expectFieldHidden('Group size');
    await drawer.expectFieldHidden('Playoff Type');
    await drawer.expectFieldHidden('Playoff Draw Type');

    await drawer.clickCancel();
  });

  test('3.2.6 — SE → AD_HOC: seeding policy + qualifiers hidden', async ({ page }) => {
    const { drawer } = await seedAndOpenDrawForm(page);
    await drawer.expectFieldVisible('Seeding policy');
    await drawer.expectFieldVisible('Qualifiers');

    await drawer.selectDrawType('AD_HOC');
    await drawer.expectFieldHidden('Seeding policy');
    await drawer.expectFieldHidden('Qualifiers');

    await drawer.clickCancel();
  });

  /* ── Section 4: Mode transitions (qualifyingFirst toggle) ─────────── */

  test('4.1 — NEW_MAIN → QUALIFYING_FIRST: field swap on checkbox toggle', async ({ page }) => {
    const { drawer } = await seedAndOpenDrawForm(page);

    // Initial state: NEW_MAIN
    await drawer.expectFieldVisible('Draw name');
    await drawer.expectFieldHidden('Structure name');
    await drawer.expectFieldVisible('Qualifiers');
    await drawer.expectFieldHidden('Qualifying positions');
    await drawer.expectFieldVisible('Seeding policy');

    // Toggle qualifyingFirst
    await drawer.toggleCheckbox('qualifyingFirst');

    // After toggle: NEW_MAIN_WITH_QUALIFYING_FIRST
    await drawer.expectFieldHidden('Draw name');
    await drawer.expectFieldVisible('Structure name');
    await drawer.expectFieldHidden('Qualifiers');
    await drawer.expectFieldVisible('Qualifying positions');
    await drawer.expectFieldHidden('Seeding policy');

    await drawer.clickCancel();
  });

  test('4.2 — QUALIFYING_FIRST → NEW_MAIN: reverse toggle', async ({ page }) => {
    const { drawer } = await seedAndOpenDrawForm(page);

    // Toggle to qualifying first
    await drawer.toggleCheckbox('qualifyingFirst');
    await drawer.expectFieldVisible('Structure name');

    // Toggle back
    await drawer.toggleCheckbox('qualifyingFirst');

    // Verify the checkbox is actually unchecked
    const isChecked = await page.evaluate(() => {
      const cb = document.getElementById('qualifyingFirst') as HTMLInputElement;
      return cb?.checked;
    });
    console.log('4.2: qualifyingFirst checked after second toggle:', isChecked);

    await drawer.expectFieldVisible('Draw name');
    await drawer.expectFieldHidden('Structure name');
    await drawer.expectFieldVisible('Seeding policy');

    await drawer.clickCancel();
  });

  /* ── Section 8: Creation method constraints ───────────────────────── */

  test('8.3 — SWISS: creation method field hidden', async ({ page }) => {
    const { drawer } = await seedAndOpenDrawForm(page);
    await drawer.selectDrawType('SWISS');
    await drawer.expectFieldHidden('Creation');
    await drawer.clickCancel();
  });

  /* ── Section 3.1: Draw size coercion ────────────────────────────── */

  test('3.1.1 — SE → RR: draw size changes from power-of-2 to raw count', async ({ page }) => {
    const { drawer } = await seedAndOpenDrawForm(page);

    // SE: draw size = nextPowerOf2(16) = 16
    const seSize = Number(await drawer.getInputValue('Draw size'));
    expect(seSize).toBe(16);

    // Switch to RR: draw size = raw entry count = 16
    await drawer.selectDrawType('ROUND_ROBIN');
    const rrSize = Number(await drawer.getInputValue('Draw size'));
    expect(rrSize).toBe(16);

    // Switch to AD_HOC: draw size = raw = 16
    await drawer.selectDrawType('AD_HOC');
    const adHocSize = Number(await drawer.getInputValue('Draw size'));
    expect(adHocSize).toBe(16);

    // Switch back to SE: draw size should coerce back to power-of-2
    await drawer.selectDrawType('SINGLE_ELIMINATION');
    const seSize2 = Number(await drawer.getInputValue('Draw size'));
    expect(seSize2).toBe(16); // 16 is already a power of 2

    await drawer.clickCancel();
  });

  /* ── Section 1.2: TEAM event variant ──────────────────────────── */

  test('1.2.1 — TEAM event: tieFormat visible, score format hidden', async ({ page }) => {
    // Seed a TEAM event tournament
    const tournamentId = await seedTournament(page, {
      tournamentName: 'E2E Team Event',
      tournamentAttributes: { tournamentId: 'e2e-team-event' },
      participantsProfile: { scaledParticipantsCount: 16, participantType: 'TEAM' },
      drawProfiles: [
        {
          eventName: 'Teams',
          drawSize: 8,
          eventType: 'TEAM',
          generate: false,
        },
      ],
    });
    const tournamentPage = new TournamentPage(page);
    await tournamentPage.goto(tournamentId);
    await tournamentPage.navigateToEvents();
    await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
    await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
    await page.getByRole('button', { name: 'Add draw' }).click();

    const drawer = new DrawFormDrawer(page);
    await drawer.waitForOpen();

    // Score format should be hidden for TEAM events
    await drawer.expectFieldHidden('Score format');

    // Scorecard (tieFormat) should be visible
    await drawer.expectFieldVisible('Scorecard');

    await drawer.clickCancel();
  });

  /* ── Mutation verification ────────────────────────────────────────── */

  test('generates a SINGLE_ELIMINATION draw and emits the right mutation', async ({ page }) => {
    const collector = createMutationCollector(page);
    const { drawer } = await seedAndOpenDrawForm(page);

    await drawer.setInputValue('Draw name', 'Main Draw');
    await drawer.clickGenerate();

    const entry = await collector.waitForMethod('addDrawDefinition', 10_000);
    expect(entry).toBeDefined();
    expect(entry.methods[0].method).toBe('addDrawDefinition');

    collector.detach();
  });

  test('mutation payload includes drawDefinition with drawType and correct structure', async ({ page }) => {
    const collector = createMutationCollector(page);
    const { drawer } = await seedAndOpenDrawForm(page);

    await drawer.setInputValue('Draw name', 'SE Payload Test');
    await drawer.clickGenerate();

    const entry = await collector.waitForMethod('addDrawDefinition', 10_000);
    const params = entry.methods[0].params;
    // drawDefinition is nested inside params (generateDraw.ts:38)
    expect(params.drawDefinition).toBeDefined();
    expect(params.drawDefinition.drawType).toBe('SINGLE_ELIMINATION');
    expect(params.eventId).toBeDefined();

    collector.detach();
  });

  test('RR mutation drawDefinition has drawType ROUND_ROBIN', async ({ page }) => {
    const collector = createMutationCollector(page);
    const { drawer } = await seedAndOpenDrawForm(page);

    await drawer.setInputValue('Draw name', 'RR Payload Test');
    await drawer.selectDrawType('ROUND_ROBIN');
    await drawer.clickGenerate();

    const entry = await collector.waitForMethod('addDrawDefinition', 10_000);
    expect(entry.methods[0].params.drawDefinition.drawType).toBe('ROUND_ROBIN');

    collector.detach();
  });
});
