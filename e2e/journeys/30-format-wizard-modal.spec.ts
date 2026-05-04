import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament } from '../helpers/seed';
import { FormatWizardModal } from '../pages/FormatWizardModal';

/**
 * Phase 1.C.2 e2e coverage — modal scaffold + constraints form.
 *
 * The modal's user-facing entry point (Tournament Actions menu) is
 * deferred to Phase 1.C.4. These tests open the modal directly via
 * `dev.openFormatWizardModal(...)` to exercise the form behaviour
 * before the full flow is wired.
 */

test.describe('Journey 30 — Format Wizard modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);

    // Seed a tournament whose draw category specifies a rating scale —
    // this is how mocksEngine attaches `ratings.utr.utrRating` to each
    // generated participant. The wizard reads participants from
    // tournamentEngine.getParticipants and resolves a numeric rating
    // via the active scale, so a non-rating-aware seed yields zero
    // rated participants and an empty plan list.
    await seedTournament(page, {
      tournamentName: 'Format Wizard E2E',
      tournamentAttributes: { tournamentId: 'e2e-format-wizard-001' },
      drawProfiles: [
        {
          eventName: 'UTR 4-7 SINGLES',
          category: { ratingType: 'UTR', ratingMin: 4, ratingMax: 7 },
          scaledParticipantsCount: 16,
          drawType: 'SINGLE_ELIMINATION',
          drawSize: 16,
          seedsCount: 4,
        },
      ],
    });
  });

  test('opens with the constraints form rendered and the right-pane placeholder', async ({ page }) => {
    const wizard = new FormatWizardModal(page);
    await wizard.open();

    await expect(wizard.form).toBeVisible();
    await expect(wizard.rightPane).toBeVisible();

    // All seven form controls are present
    await expect(wizard.scaleSelect).toBeVisible();
    await expect(wizard.courtsInput).toBeVisible();
    await expect(wizard.daysInput).toBeVisible();
    await expect(wizard.hoursPerDayInput).toBeVisible();
    await expect(wizard.minFloorInput).toBeVisible();
    await expect(wizard.targetCtInput).toBeVisible();
    await expect(wizard.appetiteSelect).toBeVisible();
  });

  test('seeds default values on initial open', async ({ page }) => {
    const wizard = new FormatWizardModal(page);
    await wizard.open();

    await expect(wizard.courtsInput).toHaveValue('4');
    await expect(wizard.daysInput).toHaveValue('2');
    await expect(wizard.hoursPerDayInput).toHaveValue('8');
    await expect(wizard.minFloorInput).toHaveValue('3');
    await expect(wizard.targetCtInput).toHaveValue('65');
    await expect(wizard.scaleSelect).toHaveValue('utr');
    await expect(wizard.appetiteSelect).toHaveValue('LIGHT');
  });

  test('honors initialScaleName override', async ({ page }) => {
    const wizard = new FormatWizardModal(page);
    await wizard.open('wtn');

    await expect(wizard.scaleSelect).toHaveValue('wtn');
  });

  test('user can change form values', async ({ page }) => {
    const wizard = new FormatWizardModal(page);
    await wizard.open();

    await wizard.setCourts(8);
    await wizard.setDays(3);
    await wizard.setTargetCompetitivePct(72);
    await wizard.selectAppetite('FULL');

    await expect(wizard.courtsInput).toHaveValue('8');
    await expect(wizard.daysInput).toHaveValue('3');
    await expect(wizard.targetCtInput).toHaveValue('72');
    await expect(wizard.appetiteSelect).toHaveValue('FULL');
  });

  test('renders the distribution chart for the seeded participant pool', async ({ page }) => {
    const wizard = new FormatWizardModal(page);
    await wizard.open();

    await expect(wizard.distribution).toBeVisible();
    // The chart is an SVG appended into the distribution holder
    const svgCount = await wizard.distribution.locator('svg').count();
    expect(svgCount).toBeGreaterThan(0);
  });

  test('renders ranked plan cards for the seeded pool', async ({ page }) => {
    const wizard = new FormatWizardModal(page);
    await wizard.open();

    await expect(wizard.planList).toBeVisible();
    const planCount = await wizard.planCount();
    expect(planCount).toBeGreaterThan(0);

    // Rank 1 card exists and shows a non-empty archetype label
    const rank1 = wizard.planCardByRank(1);
    await expect(rank1).toBeVisible();
    const archetypeText = (await rank1.locator('.tmx-format-wizard-plan-archetype').textContent()) ?? '';
    expect(archetypeText.trim().length).toBeGreaterThan(0);
  });

  test('plan cards re-rank when constraints change (live recompute)', async ({ page }) => {
    const wizard = new FormatWizardModal(page);
    await wizard.open();

    // Capture rank-1 archetype with default constraints
    const initialArchetype = await wizard.planCardByRank(1).locator('.tmx-format-wizard-plan-archetype').textContent();

    // Force-rank by squeezing capacity hard — fewer courts/days
    // re-orders the plan list because court-utilization scoring shifts
    await wizard.setCourts(1);
    await wizard.setDays(1);

    // The plan list re-renders synchronously (engine is sub-ms);
    // the rank-1 card may now have a different archetype OR an
    // OVER_CAPACITY warning chip — either signals recompute fired.
    const newArchetype = await wizard.planCardByRank(1).locator('.tmx-format-wizard-plan-archetype').textContent();
    const hasWarning = await wizard
      .planCardByRank(1)
      .locator('.tmx-format-wizard-warning-chip[data-warning="OVER_CAPACITY"]')
      .count();

    expect(initialArchetype !== newArchetype || hasWarning > 0).toBe(true);
  });
});
