/**
 * Journey 149 — a draw generated before its entries, positioned once they arrive
 *
 * CA (2026-10-09): "we need a way to generate entire draw structures irregardless of the number of entries".
 * Shell now, draw later: the whole structure is generated with nobody placed, entries are added as they arrive,
 * and "Auto place participants" places them, with the BYEs and the seeds chosen then.
 *
 * CA (2026-10-09): "the slots for qualifiers shouldn't be reserved in advance at all, those qualifying placeholders
 * or the qualifiers themselves get placed when the draw positioning is generated".
 *
 * The positioning is random, so it runs once, in this client, and the mutation carries its positions and seeds.
 */
import { ensureDrawsTableMode, initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';
import { DrawFormDrawer } from '../pages/DrawFormDrawer';
import { S } from '../helpers/selectors';

const TOURNAMENT_ID = 'e2e-draw-before-entries';
const AUTO_PLACE = 'Auto place participants';
const DRAW_SIZE = 'Draw size';

/** An event with no entries, and participants to enter later. */
async function seedEmptyEvent(page: Page): Promise<void> {
  await page.evaluate(async (tournamentId) => {
    await dev.tmx2db.initDB();
    const factory: any = dev.factory;
    const engine = factory.tournamentEngine;
    const { tournamentRecord } = factory.mocksEngine.generateTournamentRecord({
      tournamentAttributes: { tournamentId },
      participantsProfile: { participantsCount: 16 },
      tournamentName: 'E2E Draw Before Entries',
      setState: true,
      nonRandom: 1,
    });
    engine.addEvent({ event: { eventName: 'Singles', eventType: 'SINGLES' } });
    await dev.load({ tournamentRecord: engine.getTournament().tournamentRecord });
    return tournamentRecord.tournamentId;
  }, TOURNAMENT_ID);
}

/** 10 entries arrive after the draw exists; the first 4 carry the event's seeding. */
async function enterLate(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const engine: any = dev.factory.tournamentEngine;
    engine.setState(dev.getTournament());
    const event = engine.getTournament().tournamentRecord.events[0];
    const { eventId } = event;
    const drawId = event.drawDefinitions[0].drawId;
    const participantIds = engine
      .getParticipants()
      .participants.map((p: any) => p.participantId)
      .slice(0, 10);
    engine.addEventEntries({ participantIds, eventId });
    engine.addDrawEntries({ participantIds, eventId, drawId });
    const scaleItemsWithParticipantIds = participantIds.slice(0, 4).map((participantId: string, index: number) => ({
      scaleItems: [{ scaleType: 'SEEDING', eventType: 'SINGLES', scaleName: eventId, scaleValue: index + 1 }],
      participantId,
    }));
    engine.setParticipantScaleItems({ scaleItemsWithParticipantIds });
    await dev.load({ tournamentRecord: engine.getTournament().tournamentRecord });
  });
}

const mainStructure = (page: Page) =>
  page.evaluate(() => {
    const draw = dev.getTournament().events[0].drawDefinitions?.[0];
    const main = draw?.structures.find((s: any) => s.stage === 'MAIN');
    if (!main) return undefined;
    const assignments = main.positionAssignments ?? [];
    const placed = new Set(assignments.map((pa: any) => pa.participantId).filter(Boolean));
    const seeds = (main.seedAssignments ?? []).filter((sa: any) => sa.participantId);
    return {
      positions: assignments.length,
      participants: placed.size,
      byes: assignments.filter((pa: any) => pa.bye).length,
      qualifiers: assignments.filter((pa: any) => pa.qualifier).length,
      seedsPlaced: seeds.filter((sa: any) => placed.has(sa.participantId)).length,
      seeds: seeds.length,
    };
  });

async function openAddDraw(page: Page): Promise<DrawFormDrawer> {
  const tournamentPage = new TournamentPage(page);
  await tournamentPage.goto(TOURNAMENT_ID);
  await tournamentPage.navigateToEvents();
  await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
  await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
  await page.getByRole('button', { name: 'Add draw' }).click();
  const drawer = new DrawFormDrawer(page);
  await drawer.waitForOpen();
  return drawer;
}

async function openDrawView(page: Page): Promise<void> {
  const tournamentPage = new TournamentPage(page);
  await tournamentPage.goto(TOURNAMENT_ID);
  await tournamentPage.navigateToEvents();
  await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
  await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
  await page.locator('#eventTabsBar').getByText('Draws').click();
  await page.locator('.tabulator-row').first().waitFor({ state: 'visible', timeout: 5_000 });
  await page.locator('.tabulator-row').first().click();
  await page.locator(S.DRAW_CONTROL).waitFor({ state: 'visible', timeout: 10_000 });
}

async function autoPlace(page: Page): Promise<void> {
  const eventControl = page.locator(S.EVENT_CONTROL);
  await eventControl.waitFor({ state: 'visible', timeout: 5_000 });
  // the structure's actions sit under Actions; the Main dropdown only chooses the structure
  await eventControl.getByRole('button', { name: 'Actions' }).click();
  await page.locator('.dropdown-menu .dropdown-item:visible', { hasText: AUTO_PLACE }).first().click();
}

test.describe('Journey 149 — a draw generated before its entries', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await ensureDrawsTableMode(page);
    await seedEmptyEvent(page);
  });

  test('a typed draw size survives the draw type, and the draw is generated with nobody placed', async ({ page }) => {
    const drawer = await openAddDraw(page);
    await drawer.setInputValue(DRAW_SIZE, '24');
    await drawer.selectDrawType('FEED_IN');
    // choosing the draw type used to reset the size to entries + qualifiers: 0 entries, so 0
    await expect(drawer.fieldInput(DRAW_SIZE)).toHaveValue('24');

    await drawer.clickGenerate();
    await drawer.waitForClose();

    await expect
      .poll(() => mainStructure(page), { timeout: 10_000 })
      .toEqual({ positions: 24, participants: 0, byes: 0, qualifiers: 0, seeds: 0, seedsPlaced: 0 });
  });

  test('entries arriving later are placed, with BYEs and seeds, by Auto place participants', async ({ page }) => {
    const drawer = await openAddDraw(page);
    await drawer.setInputValue(DRAW_SIZE, '32');
    await drawer.clickGenerate();
    await drawer.waitForClose();
    await expect.poll(() => mainStructure(page), { timeout: 10_000 }).toMatchObject({ positions: 32, participants: 0 });

    await enterLate(page);
    const expectedSeeds = await page.evaluate(() => {
      const engine: any = dev.factory.tournamentEngine;
      const drawId = dev.getTournament().events[0].drawDefinitions[0].drawId;
      return engine.getSeedsCount({ participantsCount: 10, drawSize: 32, drawId }).seedsCount;
    });
    expect(expectedSeeds).toBeGreaterThan(0);

    await openDrawView(page);
    await autoPlace(page);

    await expect
      .poll(() => mainStructure(page), { timeout: 10_000 })
      .toEqual({
        seedsPlaced: expectedSeeds,
        seeds: expectedSeeds,
        participants: 10,
        qualifiers: 0,
        positions: 32,
        byes: 22,
      });
  });
});
