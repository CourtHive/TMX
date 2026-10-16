import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect } from '@playwright/test';

test('a delayed earlier tournament load cannot replace the newer selection', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);
  await page.evaluate(async () => {
    await dev.tmx2db.initDB();
    for (const id of ['assessment-load-a', 'assessment-load-b']) {
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        setState: true,
        tournamentAttributes: { tournamentId: id },
        drawProfiles: [{ drawSize: 8 }],
      });
      await dev.tmx2db.addTournament(tournamentRecord);
    }
    dev.factory.tournamentEngine.reset();
    const find = dev.tmx2db.findTournament.bind(dev.tmx2db);
    dev.tmx2db.findTournament = (id: string) =>
      id === 'assessment-load-a'
        ? new Promise((resolve) => {
            (globalThis as any).releaseEarlierLoad = async () => resolve(await find(id));
          })
        : find(id);
    dev.tournamentContext.router?.navigate('/tournament/assessment-load-a');
  });
  await expect.poll(() => page.evaluate(() => typeof (globalThis as any).releaseEarlierLoad)).toBe('function');
  await page.evaluate(() => dev.tournamentContext.router?.navigate('/tournament/assessment-load-b'));
  await expect
    .poll(() => page.evaluate(() => dev.factory.tournamentEngine.getTournament().tournamentRecord?.tournamentId))
    .toBe('assessment-load-b');
  await page.evaluate(() => (globalThis as any).releaseEarlierLoad());
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => dev.factory.tournamentEngine.getTournament().tournamentRecord?.tournamentId)).toBe(
    'assessment-load-b',
  );
});
