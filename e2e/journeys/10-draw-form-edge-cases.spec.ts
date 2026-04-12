/**
 * Journey 10 — Draw form: Edge cases and interactions
 *
 * Tests non-power-of-2 entry counts, FIC depth at small sizes,
 * group size option updates, and format selection.
 *
 * @see Test matrix sections 3.1, 7.1-3, 9.x
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { DrawFormDrawer } from '../pages/DrawFormDrawer';

/* ─── Seed profiles ─────────────────────────────────────────────────────── */

/** 12 entries — SE drawSize should be 16 (nextPowerOf2), RR should be 12.
 *  drawSize=16 for the flight but participantsCount=12 to get 12 entries. */
const PROFILE_12_ENTRIES: MockProfile = {
  tournamentName: 'E2E 12 Entries',
  tournamentAttributes: { tournamentId: 'e2e-12-entries' },
  participantsProfile: { scaledParticipantsCount: 16 },
  drawProfiles: [{ eventName: 'Singles', drawSize: 16, participantsCount: 12, generate: false }],
};

/** 4 entries — minimal draw for FIC depth constraints.
 *  drawSize=4 with participantsCount=4 to get exactly 4 entries. */
const PROFILE_4_ENTRIES: MockProfile = {
  tournamentName: 'E2E 4 Entries',
  tournamentAttributes: { tournamentId: 'e2e-4-entries' },
  participantsProfile: { scaledParticipantsCount: 8 },
  drawProfiles: [{ eventName: 'Singles 4', drawSize: 4, participantsCount: 4, generate: false }],
};

/** 16 entries for standard tests */
const PROFILE_16_ENTRIES: MockProfile = {
  tournamentName: 'E2E Edge Cases',
  tournamentAttributes: { tournamentId: 'e2e-edge' },
  participantsProfile: { scaledParticipantsCount: 16 },
  drawProfiles: [{ eventName: 'Singles', drawSize: 16, generate: false }],
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

async function seedAndOpenDrawForm(page: any, profile: MockProfile): Promise<DrawFormDrawer> {
  const tournamentId = await seedTournament(page, profile);
  const tournamentPage = new TournamentPage(page);
  await tournamentPage.goto(tournamentId);
  await tournamentPage.navigateToEvents();
  await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
  await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
  await page.getByRole('button', { name: 'Add draw' }).click();
  const drawer = new DrawFormDrawer(page);
  await drawer.waitForOpen();
  return drawer;
}

test.describe('Journey 10 — Draw form edge cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  /* ── Non-power-of-2 entry counts ──────────────────────────────────── */

  test('3.1 — 12 entries: SE=16 (power-of-2), switching to RR changes to 12 (raw)', async ({ page }) => {
    const drawer = await seedAndOpenDrawForm(page, PROFILE_12_ENTRIES);

    // SE default: nextPowerOf2(12) = 16
    const seSize = Number(await drawer.getInputValue('Draw size'));
    expect(seSize).toBe(16);

    // Switch to RR: raw count = 12
    await drawer.selectDrawType('ROUND_ROBIN');
    const rrSize = Number(await drawer.getInputValue('Draw size'));
    expect(rrSize).toBe(12);

    // Switch to FEED_IN: raw count = 12
    await drawer.selectDrawType('FEED_IN');
    const fiSize = Number(await drawer.getInputValue('Draw size'));
    expect(fiSize).toBe(12);

    // Switch back to SE: power-of-2 = 16
    await drawer.selectDrawType('SINGLE_ELIMINATION');
    const seSize2 = Number(await drawer.getInputValue('Draw size'));
    expect(seSize2).toBe(16);

    // Switch to FIC: power-of-2 = 16
    await drawer.selectDrawType('FEED_IN_CHAMPIONSHIP');
    const ficSize = Number(await drawer.getInputValue('Draw size'));
    expect(ficSize).toBe(16);

    await drawer.clickCancel();
  });

  /* ── FIC depth at small draw sizes ────────────────────────────────── */

  test('7.1 — drawSize=4: only Final enabled, all others disabled', async ({ page }) => {
    const drawer = await seedAndOpenDrawForm(page, PROFILE_4_ENTRIES);
    await drawer.selectDrawType('FEED_IN_CHAMPIONSHIP');

    const ficSelect = drawer.fieldSelect('Consolation feed depth');
    await drawer.expectFieldVisible('Consolation feed depth');

    const r16 = await ficSelect.locator('option[value="R16"]').getAttribute('disabled');
    const qf = await ficSelect.locator('option[value="QF"]').getAttribute('disabled');
    const sf = await ficSelect.locator('option[value="SF"]').getAttribute('disabled');
    const f = await ficSelect.locator('option[value="F"]').getAttribute('disabled');

    expect(r16).not.toBeNull(); // disabled
    expect(qf).not.toBeNull();  // disabled
    expect(sf).not.toBeNull();  // disabled
    expect(f).toBeNull();       // enabled (only option for drawSize=4)

    await drawer.clickCancel();
  });

  test('7.3 — drawSize=16: QF+SF+F enabled, R16 disabled', async ({ page }) => {
    const drawer = await seedAndOpenDrawForm(page, PROFILE_16_ENTRIES);
    await drawer.selectDrawType('FEED_IN_CHAMPIONSHIP');

    const ficSelect = drawer.fieldSelect('Consolation feed depth');

    const r16 = await ficSelect.locator('option[value="R16"]').getAttribute('disabled');
    const qf = await ficSelect.locator('option[value="QF"]').getAttribute('disabled');
    const sf = await ficSelect.locator('option[value="SF"]').getAttribute('disabled');
    const f = await ficSelect.locator('option[value="F"]').getAttribute('disabled');

    expect(r16).not.toBeNull(); // disabled (drawSize <= 16)
    expect(qf).toBeNull();      // enabled
    expect(sf).toBeNull();      // enabled
    expect(f).toBeNull();       // enabled

    await drawer.clickCancel();
  });

  /* ── Group size options update with draw size ──────────────────────── */

  test('RR group size options are valid for current draw size', async ({ page }) => {
    const drawer = await seedAndOpenDrawForm(page, PROFILE_16_ENTRIES);
    await drawer.selectDrawType('ROUND_ROBIN');

    const groupSizeSelect = drawer.fieldSelect('Group size');
    const options = await groupSizeSelect.locator('option').evaluateAll(
      (opts: HTMLOptionElement[]) => opts.map((o) => Number(o.value)),
    );

    // All group sizes should be >= 2 and <= drawSize
    for (const size of options) {
      expect(size).toBeGreaterThanOrEqual(2);
      expect(size).toBeLessThanOrEqual(16);
    }
    // Default group size is typically 4
    const selectedValue = await groupSizeSelect.inputValue();
    expect(Number(selectedValue)).toBeGreaterThanOrEqual(2);

    await drawer.clickCancel();
  });

  /* ── Draw generation with non-standard entry count ────────────────── */

  test('12-entry SE draw generates with drawSize=16', async ({ page }) => {
    const collector = createMutationCollector(page);
    const drawer = await seedAndOpenDrawForm(page, PROFILE_12_ENTRIES);

    await drawer.setInputValue('Draw name', 'SE 12');
    await drawer.clickGenerate();

    const entry = await collector.waitForMethod('addDrawDefinition', 10_000);
    const dd = entry.methods[0].params.drawDefinition;
    expect(dd.drawType).toBe('SINGLE_ELIMINATION');
    // The drawDefinition should have structures for a 16-draw
    expect(dd.structures).toBeDefined();
    expect(dd.structures.length).toBeGreaterThan(0);

    collector.detach();
  });

  test('12-entry RR draw generates with drawSize=12', async ({ page }) => {
    const collector = createMutationCollector(page);
    const drawer = await seedAndOpenDrawForm(page, PROFILE_12_ENTRIES);

    await drawer.setInputValue('Draw name', 'RR 12');
    await drawer.selectDrawType('ROUND_ROBIN');
    await drawer.clickGenerate();

    const entry = await collector.waitForMethod('addDrawDefinition', 10_000);
    const dd = entry.methods[0].params.drawDefinition;
    expect(dd.drawType).toBe('ROUND_ROBIN');

    collector.detach();
  });

  /* ── FEED_IN draw type visibility and generation ──────────────────── */

  test('1.1.4 — FEED_IN: no group size, no FIC depth, standard seeding', async ({ page }) => {
    const drawer = await seedAndOpenDrawForm(page, PROFILE_12_ENTRIES);
    await drawer.selectDrawType('FEED_IN');

    await drawer.expectFieldHidden('Group size');
    await drawer.expectFieldHidden('Consolation feed depth');
    await drawer.expectFieldVisible('Seeding policy');
    await drawer.expectFieldVisible('Qualifiers');

    // Draw size should be raw (12, not 16)
    const size = Number(await drawer.getInputValue('Draw size'));
    expect(size).toBe(12);

    await drawer.clickCancel();
  });

  /* ── LUCKY_DRAW draw size coercion ────────────────────────────────── */

  test('LUCKY_DRAW uses raw entry count (not power-of-2)', async ({ page }) => {
    const drawer = await seedAndOpenDrawForm(page, PROFILE_12_ENTRIES);
    await drawer.selectDrawType('LUCKY_DRAW');

    const size = Number(await drawer.getInputValue('Draw size'));
    expect(size).toBe(12); // raw, not 16

    await drawer.clickCancel();
  });

  /* ── ADAPTIVE draw size coercion ──────────────────────────────────── */

  test('ADAPTIVE uses raw entry count (not power-of-2)', async ({ page }) => {
    const drawer = await seedAndOpenDrawForm(page, PROFILE_12_ENTRIES);
    await drawer.selectDrawType('ADAPTIVE');

    const size = Number(await drawer.getInputValue('Draw size'));
    expect(size).toBe(12); // raw, not 16

    await drawer.clickCancel();
  });

  /* ── Multiple rapid draw type switches ────────────────────────────── */

  test('rapid draw type switching maintains correct field state', async ({ page }) => {
    const drawer = await seedAndOpenDrawForm(page, PROFILE_16_ENTRIES);

    // SE → RR → RR_PLAYOFF → SWISS → AD_HOC → SE
    await drawer.selectDrawType('ROUND_ROBIN');
    await drawer.expectFieldVisible('Group size');

    await drawer.selectDrawType('ROUND_ROBIN_WITH_PLAYOFF');
    await drawer.expectFieldVisible('Playoff Type');

    await drawer.selectDrawType('SWISS');
    await drawer.expectFieldHidden('Group size');
    await drawer.expectFieldHidden('Playoff Type');
    await drawer.expectFieldVisible('Rating scale');

    await drawer.selectDrawType('AD_HOC');
    await drawer.expectFieldHidden('Rating scale');
    await drawer.expectFieldHidden('Seeding policy');

    await drawer.selectDrawType('SINGLE_ELIMINATION');
    await drawer.expectFieldVisible('Seeding policy');
    await drawer.expectFieldHidden('Group size');
    await drawer.expectFieldHidden('Rating scale');

    await drawer.clickCancel();
  });
});
