import { ensureDrawsTableMode, initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';
import { DrawFormDrawer } from '../pages/DrawFormDrawer';
import { test, expect } from '@playwright/test';

for (const format of ['AMERICANO', 'MEXICANO']) {
  test(`creates ${format} from AD HOC and applies the first approved round`, async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await ensureDrawsTableMode(page);
    const tournamentId = await page.evaluate(async () => {
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 42,
        participantsProfile: { participantsCount: 8 },
      });
      tournamentRecord.events = [
        { eventId: 'rotating-doubles', eventName: 'Rotating Doubles', eventType: 'DOUBLES', entries: [] },
      ];
      await dev.load(tournamentRecord);
      return tournamentRecord.tournamentId;
    });
    const tournamentPage = new TournamentPage(page);
    await tournamentPage.goto(tournamentId);
    await tournamentPage.navigateToEvents();
    await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
    await page.getByRole('button', { name: 'Add draw' }).click();
    const drawer = new DrawFormDrawer(page);
    await drawer.waitForOpen();
    await expect(page.locator('#rotatingFormat')).toBeHidden();
    await drawer.selectDrawType('AD_HOC');
    await page.locator('#rotatingFormat').selectOption(format);
    await page.locator('#rotatingFormat').selectOption('STANDARD');
    await expect(drawer.fieldInput('Draw size')).toBeVisible();
    await page.locator('#rotatingFormat').selectOption(format);
    await expect(drawer.fieldInput('Draw size')).toBeHidden();
    const checkboxes = await page.locator('#rotatingRoster input').all();
    for (const checkbox of checkboxes.slice(0, 6)) await checkbox.check();
    await drawer.clickGenerate();
    await expect(page.getByText('Select between 4 and 128 individual players, in multiples of four.')).toBeVisible();
    await expect(page.locator('#rotatingFormat')).toBeVisible();
    expect(await page.evaluate(() => dev.getTournament().events[0].drawDefinitions?.length ?? 0)).toBe(0);
    for (const checkbox of checkboxes.slice(6)) await checkbox.check();
    await drawer.clickGenerate();
    await drawer.waitForClose();
    await expect
      .poll(() => page.evaluate(() => dev.getTournament().events[0].drawDefinitions?.[0]?.competitionProfile?.format))
      .toBe(format);
    await expect
      .poll(() => page.evaluate(() => dev.getTournament().events[0].drawDefinitions?.[0]?.entries?.length))
      .toBe(8);
    await page.getByRole('button', { name: 'Generate round', exact: true }).click();
    await expect(page.getByText('Preview round 1', { exact: true })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Generate round', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => dev.getTournament().events[0].drawDefinitions?.[0]?.competitionRounds?.length))
      .toBe(1);
    await expect
      .poll(() =>
        page.evaluate(() => dev.getTournament().events[0].drawDefinitions?.[0]?.structures?.[0]?.matchUps?.length),
      )
      .toBe(2);
  });
}
