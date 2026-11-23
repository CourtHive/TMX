import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';
import { test, expect, type Page } from '@playwright/test';

/**
 * Journey 225 — the participants page's footer sits where the matchUps page's does (CA 2026-11-22).
 *
 * The matchUps table is sized from its top to the window's bottom (`fitTableToViewportBottom`); the participants
 * table was still a fraction of the window, so its footer sat above a band of background on a tall window and fell
 * below the fold on a short one. And the footer's "Age" label stood alone when no participant had an age.
 */

const PARTICIPANTS_FOOTER = '.tmx-participants-footer';
const MATCHUPS_FOOTER = '.tmx-status-strip:not(.tmx-participants-footer)';

async function seed(page: Page, withAges: boolean): Promise<string> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);
  return page.evaluate(async (ages) => {
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      setState: true,
      participantsProfile: { participantsCount: 40, ...(ages ? { category: { ageCategoryCode: 'U18' } } : {}) },
      drawProfiles: [{ drawSize: 32 }],
    });
    await dev.tmx2db.addTournament(dev.factory.tournamentEngine.getTournament().tournamentRecord ?? tournamentRecord);
    return tournamentRecord.tournamentId;
  }, withAges);
}

const bottomOf = async (page: Page, selector: string) =>
  Math.round((await page.locator(selector).boundingBox())!.y + (await page.locator(selector).boundingBox())!.height);

for (const height of [720, 1000]) {
  test(`both footers end at the same place inside a ${height}px window`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height });
    const tournament = new TournamentPage(page);
    await tournament.goto(await seed(page, false));

    await tournament.navigateToParticipants();
    await expect(page.locator(PARTICIPANTS_FOOTER)).toBeVisible();
    await expect.poll(() => bottomOf(page, PARTICIPANTS_FOOTER)).toBeLessThanOrEqual(height);
    const participants = await bottomOf(page, PARTICIPANTS_FOOTER);

    await tournament.navigateToMatchUps();
    await expect(page.locator(MATCHUPS_FOOTER)).toBeVisible();
    const matchUps = await bottomOf(page, MATCHUPS_FOOTER);

    expect(Math.abs(participants - matchUps)).toBeLessThanOrEqual(1);
    expect(height - participants).toBeLessThanOrEqual(16);
  });
}

test('the Age group shows only when some participant has an age', async ({ page }) => {
  const tournament = new TournamentPage(page);
  await tournament.goto(await seed(page, false));
  await tournament.navigateToParticipants();
  await expect(page.locator(PARTICIPANTS_FOOTER)).toBeVisible();
  await expect(page.locator(`${PARTICIPANTS_FOOTER} [data-group="ages"]`)).toBeHidden();

  await tournament.goto(await seed(page, true));
  await tournament.navigateToParticipants();
  await expect(page.locator(`${PARTICIPANTS_FOOTER} [data-group="ages"]`)).toBeVisible();
  await expect(page.locator(`${PARTICIPANTS_FOOTER} .tmx-participants-footer-label`)).toHaveText('Age');
});
