import { test, expect, type Page } from '@playwright/test';
import { initDevBridge } from '../helpers/dev-bridge';
import { seedTournament } from '../helpers/seed';

/**
 * Journey 183 — the lines between rounds, shown or hidden from Edit display settings.
 *
 * "Show connectors" starts at what the composition draws (Australian draws them; BasicCard's and Wimbledon's
 * themes hide them unless `configuration.connectors` says otherwise) and saves its choice to the draw's display
 * extension. The draw view re-renders with it: a hidden line is still in the DOM, so what is asserted is the
 * line's computed opacity.
 */

const lineOpacity = (page: Page) =>
  page
    .locator('.chc-structure .chc-link--m1')
    .first()
    .evaluate((cell) => getComputedStyle(cell, '::after').opacity);

test('Show connectors off hides the draw view lines and is saved with the draw', async ({ page }) => {
  await page.goto('/');
  await initDevBridge(page);
  const tournamentId = await seedTournament(page, { drawProfiles: [{ drawSize: 8 }] } as any);
  const { eventId, drawId } = await page.evaluate(() => {
    const [event] = dev.factory.tournamentEngine.getEvents().events;
    return { eventId: event.eventId, drawId: event.drawDefinitions[0].drawId };
  });
  await page.goto(`/#/tournament/${tournamentId}/event/${eventId}/draw/${drawId}`);
  await page.locator('.chc-structure .chc-link--m1').first().waitFor({ state: 'attached' });
  expect(await lineOpacity(page)).toBe('1'); // control: the default composition draws its lines

  await page.locator('.fa-palette').first().click();
  const dialog = page.locator('.chc-modal-dialog').last();
  await expect(dialog.locator('#showConnectors')).toBeChecked();
  // the label is what a director clicks; is-checkradio hides the input itself
  await dialog.locator('label', { hasText: 'Show connectors' }).click();
  await expect(dialog.locator('#showConnectors')).not.toBeChecked();
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(page.locator('.chc-structure.chc-structure--no-connectors')).toHaveCount(1);
  expect(await lineOpacity(page)).toBe('0');
  const saved = await page.evaluate(
    (id) =>
      dev.factory.tournamentEngine.findExtension({ name: 'display', drawId: id, discover: true })?.extension?.value
        ?.configuration?.connectors,
    drawId,
  );
  expect(saved).toBe(false);
});
