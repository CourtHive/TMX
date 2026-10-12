/**
 * Journey 146 — a FEED_IN main of any size, from the Add draw form
 *
 * CA (2026-10-09): "I need to be able to create a MAIN FEED_IN with anywhere from 17-31 draw
 * positions." The form offered it all along, labelled "Staggered Entry", which nobody looking for
 * a feed-in draw would read as one. The label now says "Feed in (staggered entry)" and sits beside
 * "Feed in championship".
 *
 * Asserted here: the option is offered under that label; choosing it keeps the raw entry count as
 * the draw size (no power-of-2 coercion); generating builds a FEED_IN main with that many positions.
 */
import { ensureDrawsTableMode, initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { DrawFormDrawer } from '../pages/DrawFormDrawer';
import { test, expect } from '@playwright/test';

const ENTRIES = 23;
const FEED_IN_LABEL = 'Feed in (staggered entry)';

const PROFILE: MockProfile = {
  tournamentName: 'E2E Feed In Main',
  tournamentAttributes: { tournamentId: 'e2e-feed-in-main' },
  participantsProfile: { scaledParticipantsCount: ENTRIES },
  drawProfiles: [{ eventName: 'Singles', drawSize: 32, participantsCount: ENTRIES, generate: false }],
};

test.describe('Journey 146 — FEED_IN main of any size', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await ensureDrawsTableMode(page);
  });

  test(`a FEED_IN main of ${ENTRIES} is offered, keeps its size, and generates`, async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE);
    const tournamentPage = new TournamentPage(page);
    await tournamentPage.goto(tournamentId);
    await tournamentPage.navigateToEvents();
    await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
    await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
    await page.getByRole('button', { name: 'Add draw' }).click();
    const drawer = new DrawFormDrawer(page);
    await drawer.waitForOpen();

    // offered, under a label that says what it is
    const labels = await drawer.getSelectOptionLabels('Draw Type');
    expect(labels).toContain(FEED_IN_LABEL);
    expect(labels.indexOf(FEED_IN_LABEL) + 1).toBe(labels.indexOf('Feed in championship'));

    // CONTROL: single elimination rounds the 23 entries up to 32, so the next assertion is not vacuous
    await expect.poll(async () => drawer.getInputValue('Draw size')).toBe('32');
    await drawer.selectDrawType('FEED_IN');
    await expect.poll(async () => drawer.getInputValue('Draw size')).toBe(String(ENTRIES));

    await drawer.clickGenerate();
    await drawer.waitForClose();

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const draw = dev.getTournament().events[0].drawDefinitions?.[0];
            const main = draw?.structures?.find((s: any) => s.stage === 'MAIN');
            return draw && { drawType: draw.drawType, positions: main?.positionAssignments?.length };
          }),
        { timeout: 10_000 },
      )
      .toEqual({ drawType: 'FEED_IN', positions: ENTRIES });
  });
});
