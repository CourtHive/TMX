import { initDevBridge, resetState } from '../helpers/dev-bridge';
import { test, expect } from '@playwright/test';

/**
 * Free clock on a real local tournament runs on a demo COPY of it. The demo clock stamps simulated times into
 * whatever record it runs on (calledAt, scoredTime, timeItems), and a local tournament can later be claimed into a
 * provider, so the original is never the record the clock runs on.
 */
const PANEL = '#demoClockPanel';
const ORIGINAL_ID = 'free-clock-original';
const ORIGINAL_NAME = 'My local event';

test('Open Demo Clock on a local tournament opens a marked demo copy and leaves the original untouched', async ({
  page,
}) => {
  await page.goto('/#/tournaments');
  await initDevBridge(page);
  await resetState(page);
  await page.evaluate(
    async ({ id, name }) => {
      // A plain local tournament with a venue time zone: the scheduling-lab profile, stripped of its demo marker.
      const path = '/src/pages/tournaments/schedulerDemoProfile.ts';
      const { buildSchedulerDemoProfile } = await import(/* @vite-ignore */ path);
      const profile = buildSchedulerDemoProfile();
      const { tournamentRecord, error } = dev.factory.mocksEngine.generateTournamentRecord({
        ...profile,
        tournamentName: name,
        tournamentAttributes: { ...profile.tournamentAttributes, tournamentId: id, extensions: [] },
      });
      if (error) throw new Error(JSON.stringify(error));
      tournamentRecord.extensions = (tournamentRecord.extensions ?? []).filter((x: any) => x.name !== 'demoScript');
      await dev.tmx2db.addTournament(tournamentRecord);
      await dev.load(tournamentRecord);
    },
    { id: ORIGINAL_ID, name: ORIGINAL_NAME },
  );
  await page.evaluate((id) => dev.tournamentContext.router.navigate(`/tournament/${id}/scheduling`), ORIGINAL_ID);
  await expect(page).toHaveURL(new RegExp(ORIGINAL_ID));

  await page.locator('#login').click();
  await page.getByText('Demo mode…', { exact: true }).click();
  await page.getByRole('button', { name: 'Open Demo Clock', exact: true }).click();

  // The clock opens on a new tournament: a demo copy, loaded through the normal route.
  await expect(page).toHaveURL(/\/tournament\/demo-copy-/);
  await expect(page.locator(PANEL)).toBeVisible();
  const copy = await page.evaluate(() => dev.factory.tournamentEngine.getTournament().tournamentRecord);
  expect(copy.tournamentId).not.toBe(ORIGINAL_ID);
  expect(copy.tournamentName).toBe(`${ORIGINAL_NAME} (demo copy)`);
  expect(copy.extensions).toContainEqual({ name: 'demoScript', value: 'free-clock-copy-v1' });

  // Stepping the clock moves demo time on the copy only; the stored original is exactly as it was.
  await page.locator(PANEL).getByRole('button', { name: 'Clock controls', exact: true }).click();
  await page.locator(PANEL).getByRole('button', { name: '+5 min', exact: true }).click();
  const original = await page.evaluate((id) => dev.tmx2db.findTournament(id), ORIGINAL_ID);
  expect(original.tournamentName).toBe(ORIGINAL_NAME);
  expect((original.extensions ?? []).some((x: any) => x.name === 'demoScript')).toBe(false);

  await page.locator(PANEL).getByRole('button', { name: 'Exit clock', exact: true }).click();
  await expect(page.locator(PANEL)).toHaveCount(0);
});
