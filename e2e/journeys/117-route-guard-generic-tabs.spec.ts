import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { S } from '../helpers/selectors';

/**
 * Journey 117 — the route-level capability guard, on the tabs that reach it by the
 * GENERIC route.
 *
 * `displayRoute` has always carried a guard, and it had always been dead for a whole class
 * of tabs. The tab arrives by one of two paths: routes with a dedicated registration
 * (events, participants, scheduling, venues, reports) pass it as `selectedTab`, while
 * `/:tournamentId/:selectedTab` — which is how **publishing, matchUps, officials and
 * settings** are reached — leaves it inside `data`. The guard read only the parameter, so
 * for those four it saw `undefined` and did nothing. `...data` spreading last then put the
 * unguarded tab back into the config even in the cases where it had fired.
 *
 * Nothing looked broken: the nav icon was correctly hidden, so the only way in was a
 * bookmark, a shared link, browser history or a typed hash — exactly the cases the guard
 * exists for and the ones nobody clicks by accident.
 *
 * Publishing is the subject because a recorder is denied it (`publish`/`unpublish`) and it
 * has no dedicated route, so it sits squarely in the broken class. The posture is set
 * through the demo drawer rather than by writing storage, so the test drives the same path
 * a demonstrator does.
 */

async function bootAnonymous(page: Page): Promise<void> {
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page); // anonymous — demo-eligible
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await waitForAppReady(page);
}

async function seedTournament(page: Page): Promise<string> {
  return page.evaluate(async () => {
    await dev.tmx2db.initDB();
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      nonRandom: 1,
      setState: true,
      tournamentName: 'E2E Route Guard',
      drawProfiles: [{ eventName: 'Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
    });
    await dev.tmx2db.addTournament(tournamentRecord);
    return tournamentRecord.tournamentId as string;
  });
}

async function applyRecorderPosture(page: Page): Promise<void> {
  await page.locator('#login').click();
  await page.getByText('Demo mode…', { exact: true }).click();
  await page.locator('.drawer__content .tmx-demo-panel').waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByText('Scoring only (Recorder)', { exact: true }).click();
  await page.locator('.drawer__content .tmx-demo-panel').waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
}

test('CONTROL: with no posture applied, the publishing URL opens the publishing tab', async ({ page }) => {
  // Deliberately a separate test rather than a first step of the one below.
  // Navigating to publishing and then asserting it is hidden in the same page
  // leaves the section already rendered, so the assertion races the redirect —
  // which is how this was written first, and it failed for that reason and not
  // because the guard was wrong.
  await bootAnonymous(page);
  const tournamentId = await seedTournament(page);

  await page.goto(`/#/tournament/${tournamentId}/publishing`);
  await expect(page.locator(S.TOURNAMENT_PUBLISHING)).toBeVisible({ timeout: 15_000 });
});

test('a denied tab with no dedicated route stops answering its URL', async ({ page }) => {
  await bootAnonymous(page);
  const tournamentId = await seedTournament(page);
  await applyRecorderPosture(page);

  await page.goto(`/#/tournament/${tournamentId}/publishing`);

  // The toast is the positive signal that the guard fired, so it is awaited
  // first — "publishing is hidden" alone would also hold for a page that had
  // simply not finished rendering.
  await expect(page.locator('.notification.is-warning').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(S.TOURNAMENT_PUBLISHING)).toBeHidden();
});

test('a tab the posture still permits keeps working through the same route', async ({ page }) => {
  // The other control. A guard that redirected everything would satisfy the test
  // above; a recorder must still reach the matchUps tab, which is reached by the
  // same generic route and was in the same broken class.
  await bootAnonymous(page);
  const tournamentId = await seedTournament(page);
  await applyRecorderPosture(page);

  await page.goto(`/#/tournament/${tournamentId}/matchUps`);
  await expect(page.locator(S.TOURNAMENT_MATCHUPS)).toBeVisible({ timeout: 15_000 });
});
