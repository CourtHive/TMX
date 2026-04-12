/**
 * Journey 3 — Draw form: Round Robin with Playoff sub-states
 *
 * Tests the ROUND_ROBIN_WITH_PLAYOFF draw type's nested playoff
 * configuration: playoff type visibility, playoff draw type
 * interactions, and the forced reset transitions.
 *
 * @see Test matrix sections 2.1, 2.2, 2.3
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { DrawFormDrawer } from '../pages/DrawFormDrawer';

const PROFILE_EVENT_NO_DRAW: MockProfile = {
  tournamentName: 'E2E RR Playoff',
  tournamentAttributes: { tournamentId: 'e2e-rr-playoff' },
  participantsProfile: { scaledParticipantsCount: 16 },
  drawProfiles: [{ eventName: 'Singles', drawSize: 16, generate: false }],
};

async function openDrawFormWithRRPlayoff(page: any): Promise<DrawFormDrawer> {
  const tournamentId = await seedTournament(page, PROFILE_EVENT_NO_DRAW);
  const tournamentPage = new TournamentPage(page);
  await tournamentPage.goto(tournamentId);
  await tournamentPage.navigateToEvents();
  await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
  await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
  await page.getByRole('button', { name: 'Add draw' }).click();

  const drawer = new DrawFormDrawer(page);
  await drawer.waitForOpen();
  await drawer.selectDrawType('ROUND_ROBIN_WITH_PLAYOFF');
  return drawer;
}

test.describe('Journey 3 — RR with Playoff sub-states', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  /* ── Section 2.1: Playoff type visibility ─────────────────────────── */

  test('2.1.1 — WINNERS: advance/total/remaining fields hidden', async ({ page }) => {
    const drawer = await openDrawFormWithRRPlayoff(page);

    await drawer.fieldSelect('Playoff Type').selectOption('winners');
    await drawer.expectFieldHidden('Advance per group');
    await drawer.expectFieldHidden('Total to advance');
    await drawer.expectCheckboxHidden('groupRemaining');

    await drawer.clickCancel();
  });

  test('2.1.2 — POSITIONS: advance/total/remaining fields hidden', async ({ page }) => {
    const drawer = await openDrawFormWithRRPlayoff(page);

    await drawer.fieldSelect('Playoff Type').selectOption('positions');
    await drawer.expectFieldHidden('Advance per group');
    await drawer.expectFieldHidden('Total to advance');
    await drawer.expectCheckboxHidden('groupRemaining');

    await drawer.clickCancel();
  });

  test('2.1.3 — TOP_FINISHERS: advance per group + remaining visible', async ({ page }) => {
    const drawer = await openDrawFormWithRRPlayoff(page);

    await drawer.fieldSelect('Playoff Type').selectOption('top');
    await drawer.expectFieldVisible('Advance per group');
    await drawer.expectFieldHidden('Total to advance');
    await drawer.expectCheckboxVisible('groupRemaining');

    await drawer.clickCancel();
  });

  test('2.1.4 — BEST_FINISHERS: total advance + remaining visible', async ({ page }) => {
    const drawer = await openDrawFormWithRRPlayoff(page);

    await drawer.fieldSelect('Playoff Type').selectOption('bestFinishers');
    await drawer.expectFieldHidden('Advance per group');
    await drawer.expectFieldVisible('Total to advance');
    await drawer.expectCheckboxVisible('groupRemaining');

    await drawer.clickCancel();
  });

  /* ── Section 2.2: Playoff draw type interactions ──────────────────── */

  test('2.2.3 — playoff draw type ROUND_ROBIN: playoff group size appears', async ({ page }) => {
    const drawer = await openDrawFormWithRRPlayoff(page);

    await drawer.expectFieldHidden('Playoff Group Size');
    await drawer.fieldSelect('Playoff Draw Type').selectOption('ROUND_ROBIN');
    await drawer.expectFieldVisible('Playoff Group Size');

    await drawer.clickCancel();
  });

  /* ── Section 2.3: Forced reset transitions ────────────────────────── */

  test('2.3.1 — PAGE_PLAYOFF forces TOP_FINISHERS + advancePerGroup=2', async ({ page }) => {
    const drawer = await openDrawFormWithRRPlayoff(page);

    await drawer.fieldSelect('Playoff Draw Type').selectOption('PAGE_PLAYOFF');

    // Should force playoff type to TOP_FINISHERS
    await expect(drawer.fieldSelect('Playoff Type')).toHaveValue('top');
    // And advance per group to 2
    await expect(drawer.fieldSelect('Advance per group')).toHaveValue('2');

    await drawer.clickCancel();
  });

  test('2.3.2 — changing playoff type away from TOP_FINISHERS while PAGE_PLAYOFF resets to PLAY_OFF', async ({
    page,
  }) => {
    const drawer = await openDrawFormWithRRPlayoff(page);

    // Set PAGE_PLAYOFF (forces TOP_FINISHERS)
    await drawer.fieldSelect('Playoff Draw Type').selectOption('PAGE_PLAYOFF');
    await expect(drawer.fieldSelect('Playoff Type')).toHaveValue('top');

    // Change playoff type away from TOP_FINISHERS
    await drawer.fieldSelect('Playoff Type').selectOption('bestFinishers');

    // Playoff draw type should reset to PLAY_OFF
    await expect(drawer.fieldSelect('Playoff Draw Type')).toHaveValue('PLAY_OFF');

    await drawer.clickCancel();
  });

  test('2.3.3 — changing advancePerGroup away from 2 while PAGE_PLAYOFF resets to PLAY_OFF', async ({ page }) => {
    const drawer = await openDrawFormWithRRPlayoff(page);

    // Set PAGE_PLAYOFF (forces advancePerGroup=2)
    await drawer.fieldSelect('Playoff Draw Type').selectOption('PAGE_PLAYOFF');
    await expect(drawer.fieldSelect('Advance per group')).toHaveValue('2');

    // Change advance per group to 3
    await drawer.fieldSelect('Advance per group').selectOption('3');

    // Playoff draw type should reset to PLAY_OFF
    await expect(drawer.fieldSelect('Playoff Draw Type')).toHaveValue('PLAY_OFF');

    await drawer.clickCancel();
  });
});
