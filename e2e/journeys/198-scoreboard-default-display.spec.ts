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
  return { eventId, drawId };
}

async function openDisplaySettings(page: Page) {
  await page.locator('.fa-palette').first().click();
  const dialog = page.locator('.chc-modal-dialog').last();
  await expect(dialog.locator('[data-display-setting="scheduleInfo"]')).toBeAttached();
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
    await expect(dialog.locator('[data-display-setting="scheduleInfo"]')).toBeChecked();
    await expect(dialog.locator('[data-display-setting="connectors"]')).toBeChecked();
    await expect(dialog.locator('[data-display-setting="flags"]')).toBeChecked();
  });

  test('without country codes: the same, with flags off', async ({ page }) => {
    await seedAndOpen(page, { withCountryCodes: false });
    await page
      .locator('.chc-structure')
      .first()
      .screenshot({ path: test.info().outputPath('without-flags.png') });

    const dialog = await openDisplaySettings(page);
    await expect(dialog.locator('select').first()).toHaveValue('Scoreboard');
    await expect(dialog.locator('[data-display-setting="scheduleInfo"]')).toBeChecked();
    await expect(dialog.locator('[data-display-setting="connectors"]')).toBeChecked();
    await expect(dialog.locator('[data-display-setting="flags"]')).not.toBeChecked();
  });

  test('advanced edits survive mode changes, Save and reopening, while previews preserve the tournament', async ({
    page,
  }) => {
    const { drawId } = await seedAndOpen(page, { withCountryCodes: true });
    const before = await page.evaluate(
      () => dev.factory.tournamentEngine.getTournament().tournamentRecord.tournamentId,
    );
    let dialog = await openDisplaySettings(page);
    await expect(dialog.locator('.chc-display-settings')).toHaveAttribute('data-mode', 'basic');
    await dialog.screenshot({ path: test.info().outputPath('display-settings-basic.png') });
    await dialog.getByRole('button', { name: 'Advanced settings', exact: true }).click();
    await dialog.locator('.ce-section-header').filter({ hasText: 'Colors' }).click();
    await dialog
      .locator('.ce-color-field')
      .filter({ hasText: 'Accent color' })
      .locator('input[type="text"]')
      .fill('#ff6a00');
    await dialog.getByRole('button', { name: 'Basic settings', exact: true }).click();
    const footer = dialog.locator('[data-display-setting="matchUpFooter"]');
    await footer.locator('..').click();
    await expect(footer).toBeChecked();
    await dialog.getByRole('button', { name: 'Advanced settings', exact: true }).click();
    await expect(
      dialog.locator('.ce-color-field').filter({ hasText: 'Accent color' }).locator('input[type="text"]'),
    ).toHaveValue('#ff6a00');
    await dialog.screenshot({ path: test.info().outputPath('display-settings-advanced.png') });
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('.chc-display-settings')).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(
          (drawId) =>
            dev.factory.tournamentEngine.findExtension({ name: 'display', drawId, discover: true }).extension?.value
              ?.colors?.accent,
          drawId,
        ),
      )
      .toBe('#ff6a00');
    const stored = await page.evaluate(
      (drawId) =>
        dev.factory.tournamentEngine.findExtension({ name: 'display', drawId, discover: true }).extension.value,
      drawId,
    );
    expect(stored.configuration.matchUpFooter).toBe(true);
    expect(stored.configuration.scheduleInfo).toMatchObject({ elapsed: true, eventRound: true });
    expect(await page.evaluate(() => dev.factory.tournamentEngine.getTournament().tournamentRecord.tournamentId)).toBe(
      before,
    );
    dialog = await openDisplaySettings(page);
    await expect(dialog.locator('[data-display-setting="matchUpFooter"]')).toBeChecked();
    await dialog.getByRole('button', { name: 'Advanced settings', exact: true }).click();
    await dialog.locator('.ce-section-header').filter({ hasText: 'Colors' }).click();
    await expect(
      dialog.locator('.ce-color-field').filter({ hasText: 'Accent color' }).locator('input[type="text"]'),
    ).toHaveValue('#ff6a00');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  });

  test('Cancel leaves the draw display unchanged', async ({ page }) => {
    const { drawId } = await seedAndOpen(page, { withCountryCodes: false });
    const read = () =>
      page.evaluate(
        (drawId) =>
          dev.factory.tournamentEngine.findExtension({ name: 'display', drawId, discover: true }).extension?.value,
        drawId,
      );
    const before = await read();
    const dialog = await openDisplaySettings(page);
    await dialog.locator('[data-display-setting="flags"]').locator('..').click();
    await dialog.getByRole('button', { name: 'Advanced settings', exact: true }).click();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(await read()).toEqual(before);
  });

  test('advanced settings fit a short mobile viewport with Save reachable', async ({ page }) => {
    await seedAndOpen(page, { withCountryCodes: false });
    await page.setViewportSize({ width: 390, height: 560 });
    const dialog = await openDisplaySettings(page);
    await dialog.getByRole('button', { name: 'Advanced settings', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeInViewport();
    await dialog.screenshot({ path: test.info().outputPath('display-settings-mobile.png') });
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  });
});
