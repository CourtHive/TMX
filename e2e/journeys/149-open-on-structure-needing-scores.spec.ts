/**
 * Journey 149 — a draw opens on the structure that still needs scores
 *
 * CA (2026-10-15): "when there is a qualifying structure and a main structure (simplest case) and the
 * qualifying structure is complete, we should open on the main structure, the structure that still
 * required score entry. Qualifying should only open first if it has unentered scores."
 */
import { ensureDrawsTableMode, initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';
import { test, expect, type Page } from '@playwright/test';
import { S } from '../helpers/selectors';

/** A 16-draw main fed by an 8-draw qualifying; `completeQualifying` scores every qualifying matchUp. */
async function seedQualifyingAndMain(page: Page, completeQualifying: boolean): Promise<string> {
  return page.evaluate(
    async ({ completeQualifying }) => {
      await dev.tmx2db.initDB();
      const factory: any = dev.factory;
      const engine = factory.tournamentEngine;
      const tournamentId = `e2e-open-on-needing-scores-${completeQualifying ? 'done' : 'open'}`;
      factory.mocksEngine.generateTournamentRecord({
        tournamentAttributes: { tournamentId },
        tournamentName: 'E2E Open On Needing Scores',
        drawProfiles: [
          {
            drawSize: 16,
            qualifyingProfiles: [{ structureProfiles: [{ drawSize: 8, qualifyingPositions: 4 }] }],
          },
        ],
        setState: true,
        nonRandom: 1,
      });

      if (completeQualifying) {
        const { outcome } = factory.mocksEngine.generateOutcomeFromScoreString({
          scoreString: '6-1 6-1',
          winningSide: 1,
        });
        // one round at a time: a later round's sides exist only once the round before it is scored
        for (let pass = 0; pass < 4; pass++) {
          // filtered on `stage` itself: a `stages` matchUpFilter matched nothing here, and a seed that scores
          // nothing would make the assertion below pass on an empty list
          const matchUps = engine.allTournamentMatchUps().matchUps.filter((m: any) => m.stage === 'QUALIFYING');
          for (const matchUp of matchUps) {
            const ready = matchUp.readyToScore && !matchUp.winningSide && matchUp.matchUpStatus !== 'BYE';
            if (!ready) continue;
            const { drawId, matchUpId } = matchUp;
            engine.setMatchUpStatus({ outcome, matchUpId, drawId });
          }
        }
      }

      await dev.load({ tournamentRecord: engine.getTournament().tournamentRecord });
      return tournamentId;
    },
    { completeQualifying },
  );
}

/** Open the event's only draw from the draws table, with no structure asked for. */
async function openDraw(page: Page, tournamentId: string): Promise<void> {
  const tournamentPage = new TournamentPage(page);
  await tournamentPage.goto(tournamentId);
  await tournamentPage.navigateToEvents();
  await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
  await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
  await page.locator('#eventTabsBar').getByText('Draws').click();
  await page.locator('.tabulator-row').first().waitFor({ state: 'visible', timeout: 5_000 });
  await page.locator('.tabulator-row').first().click();
  await page.locator(S.DRAW_CONTROL).waitFor({ state: 'visible', timeout: 10_000 });
}

/** The structure on screen, as its dropdown in the event control bar names it. */
function viewedStructure(page: Page) {
  return page.locator(S.EVENT_CONTROL).getByRole('button', { name: /^(Qualifying|Main)$/ });
}

test.describe('Journey 149 — open on the structure that still needs scores', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await ensureDrawsTableMode(page);
  });

  test('a completed qualifying is passed over: the draw opens on Main', async ({ page }) => {
    const tournamentId = await seedQualifyingAndMain(page, true);
    const qualifying = await page.evaluate(() => {
      const matchUps = dev.factory.tournamentEngine
        .allTournamentMatchUps()
        .matchUps.filter((m: any) => m.stage === 'QUALIFYING');
      return { total: matchUps.length, unscored: matchUps.filter((m: any) => !m.winningSide).length };
    });
    expect(qualifying.total, 'the seed built a qualifying').toBeGreaterThan(0);
    expect(qualifying.unscored, 'the seed scored every qualifying matchUp').toBe(0);

    await openDraw(page, tournamentId);

    await expect(viewedStructure(page)).toHaveText('Main');
  });

  test('a qualifying with scores still to enter opens first, as before', async ({ page }) => {
    const tournamentId = await seedQualifyingAndMain(page, false);

    await openDraw(page, tournamentId);

    await expect(viewedStructure(page)).toHaveText('Qualifying');
  });
});
