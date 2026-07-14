import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { enterScore } from '../helpers/enterScore';

/**
 * Round-robin draws register a refresh hook so scores repaint in place.
 *
 * Regression: the events tab renders a round-robin (CONTAINER) structure via
 * createBracketTable directly, which — unlike renderDrawView (used by elimination
 * draws) — never set context.refreshActiveTable. Combined with the destroyTables()
 * that nulls it on tab render, RR/rounds/stats views were left with NO refresher, so
 * a remote (broadcast) or modal score mutation had nothing to repaint them and fell
 * back to the non-actionable navbar sync indicator — the "round robin brackets don't
 * update when scores arrive" bug. eventsTab.renderDrawTab now registers a re-render
 * for the create*Table sub-views. Verified end-to-end against a live server broadcast;
 * this hermetic test asserts the hook is set AND that firing it repaints the bracket.
 */
test('round-robin bracket registers a refresh hook and repaints on score', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);
  await page.evaluate(() => localStorage.clear());

  const seed = await page.evaluate(async () => {
    await dev.tmx2db.initDB();
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      nonRandom: 1,
      setState: true,
      tournamentName: 'RR Remote Refresh',
      drawProfiles: [{ drawType: 'ROUND_ROBIN', drawSize: 4, eventType: 'SINGLES' }],
    });
    await dev.tmx2db.addTournament(tournamentRecord);
    const ev = tournamentRecord.events[0];
    return {
      tournamentId: tournamentRecord.tournamentId as string,
      eventId: ev.eventId as string,
      drawId: ev.drawDefinitions[0].drawId as string,
    };
  });

  // Open the round-robin draw (renders the CONTAINER/bracket sub-view).
  await page.goto(`/#/tournament/${seed.tournamentId}/event/${seed.eventId}/draw/${seed.drawId}`);
  await page.locator('#drawsView').waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1500);

  // The fix: viewing a RR bracket registers a refresh hook (was undefined before).
  const hookType = await page.evaluate(() => typeof dev.tournamentContext?.refreshActiveTable);
  expect(hookType, 'RR bracket view must register context.refreshActiveTable').toBe('function');

  // Pick an unscored RR matchUp; the bracket should not yet show a score.
  const matchUpId = await page.evaluate((drawId) => {
    const { matchUps } = dev.factory.tournamentEngine.allDrawMatchUps({ drawId, inContext: true });
    return matchUps.find((m: any) => m.sides?.filter((s: any) => s.participant).length === 2 && !m.winningSide)
      ?.matchUpId as string | undefined;
  }, seed.drawId);
  expect(matchUpId, 'found an unscored RR matchUp').toBeTruthy();

  const scoreShown = () =>
    page.evaluate(() => {
      const dv = document.getElementById('drawsView');
      return !!dv && /6[\s\-/]*[23]/.test(dv.innerText || '');
    });
  expect(await scoreShown(), 'bracket should have no score before').toBe(false);

  // Apply a score and fire the refresh hook (mirrors what a remote broadcast / the
  // scoring modal does). Post-fix this repaints the bracket in place.
  await enterScore(page, { matchUpId: matchUpId!, drawId: seed.drawId, scoreString: '6-2 6-3', refreshActive: true });
  await page.waitForTimeout(600);

  expect(await scoreShown(), 'bracket must repaint with the score after refresh').toBe(true);
});
