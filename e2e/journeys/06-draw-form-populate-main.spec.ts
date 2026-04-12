/**
 * Journey 6 — Draw form: POPULATE_MAIN mode
 *
 * Tests the draw form when populating an existing main-draw placeholder
 * (created by a qualifying-first flow). Also tests draw generation
 * mutations for multiple draw types.
 *
 * @see Test matrix section 1.5
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { DrawFormDrawer } from '../pages/DrawFormDrawer';

/* ─── Seed profiles ─────────────────────────────────────────────────────── */

/** Tournament with a main draw already generated — used to test
 *  draw generation mutations for various draw types. */
const PROFILE_FOR_GENERATION: MockProfile = {
  tournamentName: 'E2E Draw Generation',
  tournamentAttributes: { tournamentId: 'e2e-draw-gen' },
  participantsProfile: { scaledParticipantsCount: 16 },
  eventProfiles: [{ eventName: 'Singles', drawProfiles: [] }],
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

async function seedAndOpenDrawForm(page: any): Promise<{
  drawer: DrawFormDrawer;
  collector: ReturnType<typeof createMutationCollector>;
}> {
  const collector = createMutationCollector(page);
  const tournamentId = await seedTournament(page, PROFILE_FOR_GENERATION);
  const tournamentPage = new TournamentPage(page);
  await tournamentPage.goto(tournamentId);
  await tournamentPage.navigateToEvents();
  await page.locator(`${tournamentPage.eventsTable.toString()} .tabulator-row`).first().click();
  await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
  await page.getByRole('button', { name: 'Add draw' }).click();

  const drawer = new DrawFormDrawer(page);
  await drawer.waitForOpen();
  return { drawer, collector };
}

/* ─── Tests ──────────────────────────────────────────────────────────────── */

test.describe('Journey 6 — Draw generation mutations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('ROUND_ROBIN generation emits addDrawDefinition', async ({ page }) => {
    const { drawer, collector } = await seedAndOpenDrawForm(page);

    await drawer.setInputValue('Draw name', 'RR Draw');
    await drawer.selectDrawType('ROUND_ROBIN');
    await drawer.clickGenerate();

    const entry = await collector.waitForMethod('addDrawDefinition', 10_000);
    expect(entry).toBeDefined();
    collector.detach();
  });

  test('ROUND_ROBIN_WITH_PLAYOFF generation emits addDrawDefinition', async ({ page }) => {
    const { drawer, collector } = await seedAndOpenDrawForm(page);

    await drawer.setInputValue('Draw name', 'RR Playoff Draw');
    await drawer.selectDrawType('ROUND_ROBIN_WITH_PLAYOFF');
    await drawer.clickGenerate();

    const entry = await collector.waitForMethod('addDrawDefinition', 10_000);
    expect(entry).toBeDefined();
    collector.detach();
  });

  test('FEED_IN_CHAMPIONSHIP generation emits addDrawDefinition', async ({ page }) => {
    const { drawer, collector } = await seedAndOpenDrawForm(page);

    await drawer.setInputValue('Draw name', 'FIC Draw');
    await drawer.selectDrawType('FEED_IN_CHAMPIONSHIP');
    await drawer.clickGenerate();

    const entry = await collector.waitForMethod('addDrawDefinition', 10_000);
    expect(entry).toBeDefined();
    collector.detach();
  });

  test('AD_HOC generation emits addDrawDefinition', async ({ page }) => {
    const { drawer, collector } = await seedAndOpenDrawForm(page);

    await drawer.setInputValue('Draw name', 'Ad Hoc Draw');
    await drawer.selectDrawType('AD_HOC');
    await drawer.clickGenerate();

    const entry = await collector.waitForMethod('addDrawDefinition', 10_000);
    expect(entry).toBeDefined();
    collector.detach();
  });

  test('DRAW_MATIC generation emits addDrawDefinition', async ({ page }) => {
    const { drawer, collector } = await seedAndOpenDrawForm(page);

    await drawer.setInputValue('Draw name', 'DrawMatic');
    await drawer.selectDrawType('DRAW_MATIC');
    await drawer.clickGenerate();

    const entry = await collector.waitForMethod('addDrawDefinition', 10_000);
    expect(entry).toBeDefined();
    collector.detach();
  });

  test('FEED_IN generation emits addDrawDefinition', async ({ page }) => {
    const { drawer, collector } = await seedAndOpenDrawForm(page);

    await drawer.setInputValue('Draw name', 'Feed In Draw');
    await drawer.selectDrawType('FEED_IN');
    await drawer.clickGenerate();

    const entry = await collector.waitForMethod('addDrawDefinition', 10_000);
    expect(entry).toBeDefined();
    collector.detach();
  });

  test('ADAPTIVE generation emits addDrawDefinition', async ({ page }) => {
    const { drawer, collector } = await seedAndOpenDrawForm(page);

    await drawer.setInputValue('Draw name', 'Adaptive Draw');
    await drawer.selectDrawType('ADAPTIVE');
    await drawer.clickGenerate();

    const entry = await collector.waitForMethod('addDrawDefinition', 10_000);
    expect(entry).toBeDefined();
    collector.detach();
  });

  test('LUCKY_DRAW generation emits addDrawDefinition', async ({ page }) => {
    const { drawer, collector } = await seedAndOpenDrawForm(page);

    await drawer.setInputValue('Draw name', 'Lucky Draw');
    await drawer.selectDrawType('LUCKY_DRAW');
    await drawer.clickGenerate();

    const entry = await collector.waitForMethod('addDrawDefinition', 10_000);
    expect(entry).toBeDefined();
    collector.detach();
  });

  test('SWISS generation emits addDrawDefinition', async ({ page }) => {
    const { drawer, collector } = await seedAndOpenDrawForm(page);

    await drawer.setInputValue('Draw name', 'Swiss Draw');
    await drawer.selectDrawType('SWISS');
    await drawer.clickGenerate();

    const entry = await collector.waitForMethod('addDrawDefinition', 10_000);
    expect(entry).toBeDefined();
    collector.detach();
  });
});
