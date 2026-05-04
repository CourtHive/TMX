import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, seedSuperAdminTokenInitScript, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament } from '../helpers/seed';
import { FormatWizardModal } from '../pages/FormatWizardModal';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Phase 1.C journey — format wizard end-to-end.
 *
 * Two seed shapes:
 *
 *   - "rated, no events" — rated participants attached via
 *     participantsProfile.category. The wizard's actions-menu entry
 *     should be visible and the wizard should produce real plans.
 *
 *   - "rated, draw with entries" — rated participants entered into a
 *     draw. The wizard's actions-menu entry should be hidden because
 *     event entries already exist; the dev backdoor still works for
 *     tests that need to exercise the modal in this state.
 */

const TOURNAMENT_ID_NO_EVENTS = 'e2e-format-wizard-no-events';
const TOURNAMENT_ID_WITH_DRAW = 'e2e-format-wizard-with-draw';

async function seedRatedNoEvents(page) {
  await seedTournament(page, {
    tournamentName: 'Format Wizard E2E (no events)',
    tournamentAttributes: { tournamentId: TOURNAMENT_ID_NO_EVENTS },
    participantsProfile: {
      scaledParticipantsCount: 16,
      category: { ratingType: 'UTR', ratingMin: 4, ratingMax: 7 },
    },
  });
}

async function seedRatedWithDraw(page) {
  await seedTournament(page, {
    tournamentName: 'Format Wizard E2E (with draw)',
    tournamentAttributes: { tournamentId: TOURNAMENT_ID_WITH_DRAW },
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
}

test.describe('Journey 30 — Format Wizard modal', () => {
  test.beforeEach(async ({ page }) => {
    // Format wizard is admin-gated; inject the super-admin token
    // BEFORE the first navigation so the Actions panel renders on
    // first paint of the tournament overview.
    await seedSuperAdminTokenInitScript(page);
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test.describe('Actions-menu entry — rated participants, no events', () => {
    test.beforeEach(async ({ page }) => {
      await seedRatedNoEvents(page);
      const tournament = new TournamentPage(page);
      await tournament.goto(TOURNAMENT_ID_NO_EVENTS);
    });

    test('action button is visible and opens the modal', async ({ page }) => {
      const wizard = new FormatWizardModal(page);
      await expect(wizard.actionButton).toBeVisible();
      await wizard.openViaActionsMenu();

      await expect(wizard.form).toBeVisible();
      await expect(wizard.rightPane).toBeVisible();
    });

    test('renders the distribution chart and ranked plan cards', async ({ page }) => {
      const wizard = new FormatWizardModal(page);
      await wizard.openViaActionsMenu();

      await expect(wizard.distribution).toBeVisible();
      const svgCount = await wizard.distribution.locator('svg').count();
      expect(svgCount).toBeGreaterThan(0);

      await expect(wizard.planList).toBeVisible();
      expect(await wizard.planCount()).toBeGreaterThan(0);

      const rank1 = wizard.planCardByRank(1);
      await expect(rank1).toBeVisible();
      const archetype = (await rank1.locator('.tmx-format-wizard-plan-archetype').textContent()) ?? '';
      expect(archetype.trim().length).toBeGreaterThan(0);
    });

    test('plan cards re-rank when constraints change (live recompute)', async ({ page }) => {
      const wizard = new FormatWizardModal(page);
      await wizard.openViaActionsMenu();

      const initial = await wizard.planCardByRank(1).locator('.tmx-format-wizard-plan-archetype').textContent();
      await wizard.setCourts(1);
      await wizard.setDays(1);

      const next = await wizard.planCardByRank(1).locator('.tmx-format-wizard-plan-archetype').textContent();
      const overCapacity = await wizard
        .planCardByRank(1)
        .locator('.tmx-format-wizard-warning-chip[data-warning="OVER_CAPACITY"]')
        .count();
      expect(initial !== next || overCapacity > 0).toBe(true);
    });

    test('apply button confirms and creates events + draws', async ({ page }) => {
      const wizard = new FormatWizardModal(page);
      await wizard.openViaActionsMenu();
      await expect(wizard.applyButtonByRank(1)).toBeVisible();

      const eventsBefore = await page.evaluate(
        () => ((globalThis as any).dev.factory.tournamentEngine.getEvents()?.events ?? []).length,
      );
      expect(eventsBefore).toEqual(0);

      // Programmatic click bypasses viewport-edge issues — the apply
      // button can be inside the modal's scrollable plan list.
      await wizard.applyButtonByRank(1).evaluate((b: HTMLButtonElement) => b.click());
      // Confirmation modal — click the Ok button
      await page.locator('button', { hasText: 'Ok' }).first().click();

      // Apply Plan creates events + entries only — TMX's convention
      // is that draws are generated per-flight when the TD navigates
      // to the event tab. Poll for the events to appear in factory
      // state, then assert entries are populated.
      await expect
        .poll(
          () =>
            page.evaluate(
              () => ((globalThis as any).dev.factory.tournamentEngine.getEvents()?.events ?? []).length,
            ),
          { timeout: 10_000 },
        )
        .toBeGreaterThan(0);

      const after = await page.evaluate(() => {
        const events = (globalThis as any).dev.factory.tournamentEngine.getEvents()?.events ?? [];
        const entryCounts = events.map((e: any) => (e.entries ?? []).length);
        return { eventCount: events.length, entryCounts };
      });
      expect(after.eventCount).toBeGreaterThan(0);
      expect(after.entryCounts.every((c: number) => c > 0)).toBe(true);
    });

    test('apply cancel does not create events', async ({ page }) => {
      const wizard = new FormatWizardModal(page);
      await wizard.openViaActionsMenu();

      // Programmatic click bypasses viewport-edge issues — the apply
      // button can be inside the modal's scrollable plan list.
      await wizard.applyButtonByRank(1).evaluate((b: HTMLButtonElement) => b.click());
      await page.locator('button', { hasText: 'Cancel' }).first().click();

      // Wizard stays open
      await expect(wizard.content).toBeVisible();

      const eventCount = await page.evaluate(
        () => ((globalThis as any).dev.factory.tournamentEngine.getEvents()?.events ?? []).length,
      );
      expect(eventCount).toEqual(0);
    });
  });

  test.describe('Actions-menu visibility — events with entries', () => {
    test.beforeEach(async ({ page }) => {
      await seedRatedWithDraw(page);
      const tournament = new TournamentPage(page);
      await tournament.goto(TOURNAMENT_ID_WITH_DRAW);
    });

    test('action button is hidden once events have entries', async ({ page }) => {
      const wizard = new FormatWizardModal(page);
      await expect(wizard.actionButton).toHaveCount(0);
    });
  });

  test.describe('Modal behaviour — opened via dev backdoor', () => {
    // These tests focus on form behaviour and don't depend on the
    // actions-menu visibility. Using the dev backdoor lets us seed
    // either shape without having to navigate the UI.
    test.beforeEach(async ({ page }) => {
      await seedRatedNoEvents(page);
    });

    test('seeds default values on initial open', async ({ page }) => {
      const wizard = new FormatWizardModal(page);
      await wizard.openViaDevBridge();

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
      await wizard.openViaDevBridge('wtn');
      await expect(wizard.scaleSelect).toHaveValue('wtn');
    });

    test('user can change form values', async ({ page }) => {
      const wizard = new FormatWizardModal(page);
      await wizard.openViaDevBridge();

      await wizard.setCourts(8);
      await wizard.setDays(3);
      await wizard.setTargetCompetitivePct(72);
      await wizard.selectAppetite('FULL');

      await expect(wizard.courtsInput).toHaveValue('8');
      await expect(wizard.daysInput).toHaveValue('3');
      await expect(wizard.targetCtInput).toHaveValue('72');
      await expect(wizard.appetiteSelect).toHaveValue('FULL');
    });
  });
});
