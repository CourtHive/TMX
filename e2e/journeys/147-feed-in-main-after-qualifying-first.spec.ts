/**
 * Journey 147 — a FEED_IN main generated after its qualifying, with no MAIN entries yet
 *
 * CA (2026-10-09): a qualifying of 32 producing 8 qualifiers; on the Main view, "Generate main draw",
 * draw size 22, Staggered entry. The Creation field went BLANK. Choosing Manual worked, while Automated
 * was refused with "Insufficient drawPositions to accommodate qualifiers".
 *
 * - The form opens with draw size 0 and checks on every keystroke, so typing "22" passes through "2",
 *   below the 8 qualifiers, which forces Manual. It did so by assigning the LABEL 'Manual', but the
 *   Manual option's value is `false`, so nothing matched and the field showed blank. It now selects
 *   the Manual option, and puts Automated back once the size allows it.
 * - The factory placed every BYE in round 1, which in a FEED_IN holds only some positions, so the
 *   qualifiers had no room. With no MAIN entries, a MAIN now gets only its qualifier seats.
 */
import { ensureDrawsTableMode, initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';
import { DrawFormDrawer } from '../pages/DrawFormDrawer';
import { test, expect, type Page } from '@playwright/test';
import { S } from '../helpers/selectors';

const QUALIFIERS = 8;
const DRAW_SIZE = 22;
const CREATION = 'Creation';

/** 32 QUALIFYING entries, no MAIN entries; the qualifying generated first, the main a placeholder. */
async function seedQualifyingFirst(page: Page): Promise<string> {
  return page.evaluate(
    async ({ qualifiers }) => {
      await dev.tmx2db.initDB();
      const factory: any = dev.factory;
      const engine = factory.tournamentEngine;
      const { tournamentRecord } = factory.mocksEngine.generateTournamentRecord({
        tournamentAttributes: { tournamentId: 'e2e-feed-in-after-qualifying' },
        tournamentName: 'E2E Feed In After Qualifying',
        participantsProfile: { participantsCount: 32 },
        setState: true,
        nonRandom: 1,
      });
      const eventId = engine.addEvent({ event: { eventName: 'Singles', eventType: 'SINGLES' } }).event.eventId;
      const participantIds = engine.getParticipants().participants.map((p: any) => p.participantId);
      engine.addEventEntries({ participantIds, entryStage: 'QUALIFYING', eventId });
      const drawEntries = engine.getEvent({ eventId }).event.entries;
      const qualifying = engine.generateDrawDefinition({
        qualifyingProfiles: [
          { structureProfiles: [{ qualifyingPositions: qualifiers, drawSize: 32, drawType: 'SINGLE_ELIMINATION' }] },
        ],
        ignoreStageSpace: true,
        qualifyingOnly: true,
        automated: true,
        drawEntries,
        eventId,
      });
      if (!qualifying.success) throw new Error(JSON.stringify(qualifying.error));
      engine.addDrawDefinition({ eventId, drawDefinition: qualifying.drawDefinition });
      await dev.load({ tournamentRecord: engine.getTournament().tournamentRecord });
      return tournamentRecord.tournamentId;
    },
    { qualifiers: QUALIFIERS },
  );
}

const mainStructure = (page: Page) =>
  page.evaluate(() => {
    const draw = dev.getTournament().events[0].drawDefinitions[0];
    const main = draw.structures.find((s: any) => s.stage === 'MAIN');
    const assignments = main?.positionAssignments ?? [];
    return {
      drawType: draw.drawType,
      positions: assignments.length,
      qualifiers: assignments.filter((pa: any) => pa.qualifier).length,
      byes: assignments.filter((pa: any) => pa.bye).length,
    };
  });

test.describe('Journey 147 — FEED_IN main after qualifying-first', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await ensureDrawsTableMode(page);
  });

  test('Creation never goes blank, and Automated places only the qualifier seats', async ({ page }) => {
    const tournamentId = await seedQualifyingFirst(page);
    const tournamentPage = new TournamentPage(page);
    await tournamentPage.goto(tournamentId);
    await tournamentPage.navigateToEvents();
    await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
    await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
    await page.locator('#eventTabsBar').getByText('Draws').click();
    await page.locator('.tabulator-row').first().waitFor({ state: 'visible', timeout: 5_000 });
    await page.locator('.tabulator-row').first().click();
    await page.locator(S.DRAW_CONTROL).waitFor({ state: 'visible', timeout: 10_000 });

    // the Main view of a qualifying-first draw offers "Generate main draw"; select Main if the view opened on Qualifying
    const generateMain = page.getByRole('button', { name: 'Generate main draw' });
    if (!(await generateMain.isVisible().catch(() => false))) {
      const structureMenu = page.locator(S.EVENT_CONTROL).locator('.dropdown:has-text("Qualifying")').first();
      await structureMenu.locator('.dropdown-trigger').first().click();
      await page.locator('.dropdown-menu .dropdown-item', { hasText: /^Main$/ }).first().click();
    }
    await generateMain.click();
    const drawer = new DrawFormDrawer(page);
    await drawer.waitForOpen();

    await drawer.selectDrawType('FEED_IN');
    // whatever the form decides about Automated, the select names a real option
    await expect.poll(async () => drawer.getSelectValue(CREATION)).not.toBe('');
    // typed as an operator types it: the form checks on every keystroke, so "22" passes through "2",
    // which is smaller than the 8 qualifiers and forces Manual on the way
    const drawSizeInput = drawer.fieldInput('Draw size');
    await drawSizeInput.fill('');
    await drawSizeInput.pressSequentially(String(DRAW_SIZE));
    await expect(drawSizeInput).toHaveValue(String(DRAW_SIZE));
    // the Manual forced at "2" is undone at "22": Automated is allowed again
    await expect.poll(async () => drawer.getSelectValue(CREATION)).toBe('Automated');

    await drawer.clickGenerate();
    await drawer.waitForClose();

    await expect
      .poll(() => mainStructure(page), { timeout: 10_000 })
      .toEqual({ drawType: 'FEED_IN', positions: DRAW_SIZE, qualifiers: QUALIFIERS, byes: 0 });
  });
});
