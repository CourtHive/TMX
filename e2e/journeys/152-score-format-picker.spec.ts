import { ensureDrawsTableMode, initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { seedTournament, MockProfile } from '../helpers/seed';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';
import { DrawFormDrawer } from '../pages/DrawFormDrawer';
import { S } from '../helpers/selectors';

/**
 * Journey 152 — the score-format picker hands TMX the code it shows.
 *
 * courthive-components rebuilt the matchUpFormat picker as a state machine
 * (CourtHive/courthive-components#674). Until this journey nothing in TMX opened the picker: the
 * draw-form journeys only read the "Score format" select. Two paths, one per way TMX opens it:
 *  1. the draw form's Custom score format: the picker opens on its default, "to 4" is chosen, and
 *     Select generates a draw carrying SET3-S:4/TB7;
 *  2. the structure's edit-scoring action on a draw seeded with SET3-S:6/TB7-M:T120: Select pressed
 *     untouched returns that code, so TMX reports "No changes" and writes nothing. The picker before
 *     the state machine dropped the -M:T120 time limit here and returned SET3-S:6/TB7.
 */
const MODAL_DIALOG = '.chc-modal-dialog';
const TIME_LIMITED = 'SET3-S:6/TB7-M:T120';

const PROFILE_EVENT_NO_DRAW: MockProfile = {
  tournamentName: 'E2E Score Format Picker',
  tournamentAttributes: { tournamentId: 'e2e-format-picker-form' },
  participantsProfile: { scaledParticipantsCount: 16 },
  drawProfiles: [{ eventName: 'Singles', drawSize: 16, generate: false }],
};

async function boot(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'load' });
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);
  await ensureDrawsTableMode(page);
}

/** The picker's modal: the only dialog showing the code display. */
function picker(page: Page) {
  return page.locator(MODAL_DIALOG).filter({ has: page.locator('#matchUpFormatString') });
}

async function seedTimeLimitedDraw(page: Page, tournamentId: string): Promise<{ drawId: string; structureId: string }> {
  const seeded = await page.evaluate(
    async ({ tournamentId, matchUpFormat }) => {
      await dev.tmx2db.initDB();
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        drawProfiles: [{ eventName: 'Singles', drawSize: 8, matchUpFormat }],
        tournamentAttributes: { tournamentId },
        tournamentName: 'E2E Score Format Picker',
        setState: true,
        nonRandom: 1,
      });
      await dev.load({ tournamentRecord });
      const drawDefinition = tournamentRecord.events[0].drawDefinitions[0];
      const drawId = drawDefinition.drawId as string;
      const structureId = drawDefinition.structures[0].structureId as string;
      const stored = dev.factory.tournamentEngine.getMatchUpFormat({ drawId, structureId }).matchUpFormat;
      return { drawId, structureId, stored };
    },
    { tournamentId, matchUpFormat: TIME_LIMITED },
  );
  // A seed that lost the format would make the untouched-Select assertion vacuous
  if (seeded.stored !== TIME_LIMITED) throw new Error(`seed carries ${seeded.stored}, not ${TIME_LIMITED}`);
  return { drawId: seeded.drawId, structureId: seeded.structureId };
}

async function openDrawView(page: Page, tournamentId: string): Promise<void> {
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

test.describe('journey 152 — the score-format picker', () => {
  test.beforeEach(async ({ page }) => {
    await boot(page);
  });

  test('a Custom score format edited to 4 games generates a draw carrying that code', async ({ page }) => {
    const collector = createMutationCollector(page);
    const tournamentId = await seedTournament(page, PROFILE_EVENT_NO_DRAW);
    const tournamentPage = new TournamentPage(page);
    await tournamentPage.goto(tournamentId);
    await tournamentPage.navigateToEvents();
    await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
    await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
    await page.getByRole('button', { name: 'Add draw' }).click();
    const drawer = new DrawFormDrawer(page);
    await drawer.waitForOpen();

    await drawer.setInputValue('Draw name', 'Short sets');
    await drawer.fieldSelect('Score format').selectOption('CUSTOM');
    await drawer.clickGenerate();

    const modal = picker(page);
    await expect(modal).toBeVisible();
    const code = modal.locator('#matchUpFormatString');
    await expect(code).toHaveText('SET3-S:6/TB7');

    await modal.locator('#setTo').click();
    await page.locator('.dropdown-menu > div', { hasText: /^4$/ }).click();
    await expect(code).toHaveText('SET3-S:4/TB7');

    await modal.getByRole('button', { name: 'Select', exact: true }).click();

    const entry = await collector.waitForMethod('addDrawDefinition', 10_000);
    const drawDefinition: any = entry.methods[0].params.drawDefinition;
    expect(drawDefinition.drawName).toBe('Short sets');
    expect(drawDefinition.matchUpFormat).toBe('SET3-S:4/TB7');
    collector.detach();
  });

  test('an untouched Select keeps a time-limited format and writes nothing', async ({ page }) => {
    const tournamentId = 'e2e-format-picker-structure';
    const { drawId, structureId } = await seedTimeLimitedDraw(page, tournamentId);
    await openDrawView(page, tournamentId);

    const collector = createMutationCollector(page);
    await page.locator(S.EVENT_CONTROL).locator('.fa-gear').first().click();

    const modal = picker(page);
    await expect(modal).toBeVisible();
    await expect(modal.locator('#matchUpFormatString')).toHaveText(TIME_LIMITED);

    await modal.getByRole('button', { name: 'Select', exact: true }).click();
    await expect(modal).toBeHidden();
    await expect(page.getByText('No changes').first()).toBeVisible();

    expect(collector.getMethodNames()).not.toContain('setMatchUpFormat');
    const stored = await page.evaluate(
      ({ drawId, structureId }) => dev.factory.tournamentEngine.getMatchUpFormat({ drawId, structureId }).matchUpFormat,
      { drawId, structureId },
    );
    expect(stored).toBe(TIME_LIMITED);
    collector.detach();
  });
});
