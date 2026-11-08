import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';

declare const dev: any;

/**
 * Journey 198 — a structure nobody has chosen a display for is drawn as Scoreboard, with the schedule and the
 * connectors on, and flags only when someone in the draw has a country code (CA 2026-11-08). The Display settings
 * modal opens on that same choice: it used to open on Australian while the view drew National.
 */
async function seedAndOpen(page: Page, { withCountryCodes }: { withCountryCodes: boolean }) {
  const { tournamentId, eventId, drawId } = await page.evaluate(async (withCountryCodes) => {
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      tournamentAttributes: { tournamentId: `e2e-scoreboard-default-${withCountryCodes}` },
      drawProfiles: [{ drawSize: 8 }],
      nonRandom: 1,
    });
    if (!withCountryCodes) {
      for (const participant of tournamentRecord.participants) {
        if (!participant.person) continue;
        delete participant.person.nationalityCode;
        delete participant.person.iso2NationalityCode;
      }
    }
    dev.factory.tournamentEngine.setState(tournamentRecord);
    await dev.load(tournamentRecord);
    const event = tournamentRecord.events[0];
    return {
      tournamentId: tournamentRecord.tournamentId,
      eventId: event.eventId,
      drawId: event.drawDefinitions[0].drawId,
    };
  }, withCountryCodes);
  await page.goto(`/#/tournament/${tournamentId}/event/${eventId}/draw/${drawId}`);
  await page.locator('.chc-structure .chc-link--m1').first().waitFor({ state: 'attached', timeout: 10_000 });
}

async function openDisplaySettings(page: Page) {
  await page.locator('.fa-palette').first().click();
  const dialog = page.locator('.chc-modal-dialog').last();
  await expect(dialog.locator('#showSchedule')).toBeAttached();
  return dialog;
}

test.describe('Journey 198 — Scoreboard is the default structure display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('with country codes: Scoreboard, schedule, connectors and flags on', async ({ page }) => {
    await seedAndOpen(page, { withCountryCodes: true });
    await expect(page.locator('.chc-structure.chc-structure--no-connectors')).toHaveCount(0);
    await page
      .locator('.chc-structure')
      .first()
      .screenshot({ path: test.info().outputPath('with-flags.png') });

    const dialog = await openDisplaySettings(page);
    await expect(dialog.locator('select').first()).toHaveValue('Scoreboard');
    await expect(dialog.locator('#showSchedule')).toBeChecked();
    await expect(dialog.locator('#showConnectors')).toBeChecked();
    await expect(dialog.locator('#showFlags')).toBeChecked();
  });

  test('without country codes: the same, with flags off', async ({ page }) => {
    await seedAndOpen(page, { withCountryCodes: false });
    await page
      .locator('.chc-structure')
      .first()
      .screenshot({ path: test.info().outputPath('without-flags.png') });

    const dialog = await openDisplaySettings(page);
    await expect(dialog.locator('select').first()).toHaveValue('Scoreboard');
    await expect(dialog.locator('#showSchedule')).toBeChecked();
    await expect(dialog.locator('#showConnectors')).toBeChecked();
    await expect(dialog.locator('#showFlags')).not.toBeChecked();
  });
});
