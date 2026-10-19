import { initDevBridge, resetState } from '../helpers/dev-bridge';
import { test, expect } from '@playwright/test';

/**
 * The demo clock runs only on demo tournaments (the Scheduling Lab). It stamps simulated times into the record it runs
 * on (calledAt, scoredTime, timeItems), and a local tournament can later be claimed into a provider, so on a real
 * local tournament Open Demo Clock is not offered at all.
 */
const PANEL = '#demoClockPanel';
const LOCAL_ID = 'free-clock-real-local';

test('Open Demo Clock is not offered on a real local tournament', async ({ page }) => {
  await page.goto('/#/tournaments');
  await initDevBridge(page);
  await resetState(page);
  await page.evaluate(async (id) => {
    // A real local tournament with a venue time zone: the Scheduling Lab profile without its demo marker.
    const path = '/src/pages/tournaments/schedulerDemoProfile.ts';
    const { buildSchedulerDemoProfile } = await import(/* @vite-ignore */ path);
    const profile = buildSchedulerDemoProfile();
    const { tournamentRecord, error } = dev.factory.mocksEngine.generateTournamentRecord({
      ...profile,
      tournamentName: 'My local event',
      tournamentAttributes: { ...profile.tournamentAttributes, tournamentId: id },
    });
    if (error) throw new Error(JSON.stringify(error));
    tournamentRecord.extensions = (tournamentRecord.extensions ?? []).filter((x: any) => x.name !== 'demoScript');
    await dev.load(tournamentRecord);
  }, LOCAL_ID);
  await page.evaluate((id) => dev.tournamentContext.router.navigate(`/tournament/${id}/scheduling`), LOCAL_ID);
  await expect(page).toHaveURL(new RegExp(LOCAL_ID));

  await page.locator('#login').click();
  await page.getByText('Demo mode…', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Demo Clock', exact: true })).toBeDisabled();

  // Nor can it be opened directly: the loaded tournament is not a demo tournament.
  await page.evaluate(async () => {
    const panelPath = '/src/components/demoClock/demoClockPanel.ts';
    const { openDemoClockPanel } = await import(/* @vite-ignore */ panelPath);
    openDemoClockPanel('clock');
  });
  await expect(page.locator(PANEL)).toHaveCount(0);
  expect(await page.evaluate(() => Math.abs(dev.factory.tools.now().getTime() - Date.now()))).toBeLessThan(1000);
});
