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

    // Seed a small tournament so the dev bridge has factory state to operate
    // on; the modal itself doesn't read participants until 1.C.3 wires the
    // recompute, but having a tournament loaded is closer to real usage.
    await seedTournament(page, {
      tournamentName: 'Format Wizard E2E',
      tournamentAttributes: { tournamentId: 'e2e-format-wizard-001' },
      participantsProfile: { scaledParticipantsCount: 16 },
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

  test('right-pane shows placeholder copy until 1.C.3 wires content', async ({ page }) => {
    const wizard = new FormatWizardModal(page);
    await wizard.open();

    // Localized placeholder text — exact string assertions are brittle
    // across locale changes, so just assert non-empty content
    const text = (await wizard.rightPane.textContent()) ?? '';
    expect(text.trim().length).toBeGreaterThan(0);
  });
});
