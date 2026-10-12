import { ensureDrawsTableMode, initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';
import { DrawFormDrawer } from '../pages/DrawFormDrawer';
import { S } from '../helpers/selectors';

/**
 * Journey 140 — "Add qualifying" knows what already feeds the main, and how much room is left.
 *
 * On a Main structure the structure menu offers "Add qualifying". Until now it opened the draw form
 * with no idea that a qualifying structure already fed round 1, and capped the qualifiers count at
 * the whole main's size. CA's rule (2026-10-07): several qualifying structures may feed the same
 * round as long as the qualifiers they produce, in aggregate, do not exceed the drawPositions that
 * round has — and the form must make an existing feeder obvious.
 *
 * Room is OPEN positions (CA, 2026-10-09, seen in production): a position holding a participant or
 * a BYE is not room, so a main whose positions are all filled offers no qualifying at all, and a
 * freed position can be marked as a QUALIFIER placeholder for the qualifying that feeds it.
 *
 * The factory answers with `getAvailableQualifyingTargets`; the form reads its `remainingCapacity`.
 * Asserted here:
 *  1. with a qualifying already feeding round 1 of a 32 main and 8 direct entrants withdrawn, the
 *     form says so by name and count and caps the qualifiers at the 8 open positions left;
 *  2. submitting a second qualifying attaches it, and the factory then reports both feeders and
 *     the aggregate they promise;
 *  3. a FEED_IN main offers its feed round as a target, and the chosen round lands on the link;
 *  4. a full main offers no "Add qualifying"; a position freed in it can be marked QUALIFIER.
 */
const MAIN_SIZE = 32;
const FIRST_QUALIFIERS = 4;
const SECOND_QUALIFIERS = 4;
const WITHDRAWN = 8;
const QUALIFIERS_LABEL = 'Qualifiers';
const STRUCTURE_NAME_LABEL = 'Structure name';
const TARGET_ROUND_LABEL = 'Target round';
const ADD_QUALIFYING = 'Add qualifying';
const NOTICE = '#qualifyingTargetNotice';
const PLACEHOLDER = 'Assign QUALIFIER placeholder';

type Seeded = { tournamentId: string; drawId: string; mainStructureId: string };

type Prepare = { withdraw?: number; attachQualifiers?: number };

/**
 * Generate, then shape the draw before TMX loads it: `withdraw` empties that many direct-entry
 * positions (the entrant is withdrawn, so it is not waiting to be placed), and `attachQualifiers`
 * attaches a qualifying structure producing that many qualifiers into round 1.
 */
async function seed(
  page: Page,
  drawProfile: Record<string, unknown>,
  tournamentId: string,
  prepare: Prepare = {},
): Promise<Seeded> {
  return page.evaluate(
    async ({ drawProfile, tournamentId, prepare }) => {
      await dev.tmx2db.initDB();
      const engine: any = dev.factory.tournamentEngine;
      const generated = dev.factory.mocksEngine.generateTournamentRecord({
        tournamentAttributes: { tournamentId },
        drawProfiles: [{ eventName: 'Singles', ...drawProfile }],
        tournamentName: 'E2E Add Qualifying',
        setState: true,
        nonRandom: 1,
      });
      const draw: any = generated.tournamentRecord.events[0].drawDefinitions[0];
      const main = draw.structures.find((s: any) => s.stage === 'MAIN');
      const structureId = main.structureId;
      const drawId = draw.drawId;
      const direct = main.positionAssignments
        .filter((pa: any) => pa.participantId)
        .slice(0, prepare.withdraw ?? 0)
        .map((pa: any) => pa.drawPosition);
      for (const drawPosition of direct) {
        const result = engine.withdrawParticipantAtDrawPosition({ drawId, structureId, drawPosition });
        if (!result.success) throw new Error(`withdraw ${drawPosition}: ${JSON.stringify(result.error)}`);
      }
      if (prepare.attachQualifiers) {
        const result = engine.addQualifyingStructure({
          qualifyingPositions: prepare.attachQualifiers,
          drawSize: prepare.attachQualifiers * 2,
          targetStructureId: structureId,
          drawId,
        });
        if (!result.success) throw new Error(`attach: ${JSON.stringify(result.error)}`);
      }
      const { tournamentRecord } = engine.getTournament();
      await dev.load({ tournamentRecord });
      return { tournamentId: tournamentRecord.tournamentId, drawId, mainStructureId: structureId };
    },
    { drawProfile, tournamentId, prepare },
  );
}

async function readTargets(page: Page, drawId: string, structureId: string): Promise<any> {
  return page.evaluate(
    ({ drawId, structureId }) =>
      (dev.factory.tournamentEngine as any).getAvailableQualifyingTargets({ drawId, structureId }),
    { drawId, structureId },
  );
}

async function readLinks(page: Page, drawId: string): Promise<any[]> {
  return page.evaluate(
    (id) => dev.factory.tournamentEngine.getEvent({ drawId: id }).drawDefinition?.links ?? [],
    drawId,
  );
}

/** Events → first event → Draws tab → first draw: the draw view with the structure menu. */
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

/** Select Main in the structure menu, then reopen the menu: it acts on the structure being VIEWED. */
async function openMainStructureMenu(page: Page): Promise<void> {
  const eventControl = page.locator(S.EVENT_CONTROL);
  await eventControl.waitFor({ state: 'visible', timeout: 5_000 });
  // with a qualifying present the view may open on it, so select Main first
  const structureMenu = eventControl.locator('.dropdown:has-text("Main")').first();
  await structureMenu.locator('.dropdown-trigger').first().click();
  await page
    .locator('.dropdown-menu .dropdown-item', { hasText: /^Main$/ })
    .first()
    .click();
  await expect(structureMenu.locator('.dropdown-trigger')).toContainText('Main');
  await structureMenu.locator('.dropdown-trigger').first().click();
}

/** Scoped to the open menu: the text also appears elsewhere on the page. */
const addQualifyingItem = (page: Page) =>
  page.locator('.dropdown-menu .dropdown-item', { hasText: ADD_QUALIFYING }).first();

async function openAddQualifying(page: Page): Promise<DrawFormDrawer> {
  await openMainStructureMenu(page);
  const item = addQualifyingItem(page);
  await item.waitFor({ state: 'visible', timeout: 5_000 });
  await item.click();
  const drawer = new DrawFormDrawer(page);
  await drawer.waitForOpen();
  return drawer;
}

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);
  await ensureDrawsTableMode(page);
}

test.describe('journey 140 — add qualifying is target-aware', () => {
  test('an existing feeder is named, the count is capped at the room left, and a second qualifying attaches', async ({
    page,
  }) => {
    await boot(page);
    const { tournamentId, drawId, mainStructureId } = await seed(
      page,
      {
        qualifyingProfiles: [
          { roundTarget: 1, structureProfiles: [{ drawSize: 16, qualifyingPositions: FIRST_QUALIFIERS }] },
        ],
        drawType: 'SINGLE_ELIMINATION',
        drawSize: MAIN_SIZE,
      },
      'e2e-add-qualifying-fed',
      { withdraw: WITHDRAWN },
    );
    // CONTROL: the factory sees one feeder before the form is opened; otherwise the notice assertion is vacuous
    const before = await readTargets(page, drawId, mainStructureId);
    expect(before.targets.map((t: any) => t.roundNumber)).toEqual([1]);
    expect(before.targets[0].promisedQualifiers).toBe(FIRST_QUALIFIERS);
    // the 4 qualifier seats are owed to the first qualifying; only the withdrawn entrants' positions are room
    const roomLeft = WITHDRAWN;
    expect(before.targets[0].remainingCapacity).toBe(roomLeft);
    expect(before.targets[0].structuralCapacity).toBe(MAIN_SIZE - FIRST_QUALIFIERS);

    await openDrawView(page, tournamentId);
    const drawer = await openAddQualifying(page);

    // 1. the notice names the feeder and its count, and says how much room is left
    const notice = page.locator(NOTICE);
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(`Qualifying (${FIRST_QUALIFIERS})`);
    await expect(notice).toContainText(`${roomLeft} of its ${MAIN_SIZE} positions`);
    // one open round: no round to choose
    await drawer.expectFieldHidden(TARGET_ROUND_LABEL);

    // the qualifiers count cannot exceed the room left
    await drawer.setInputValue(QUALIFIERS_LABEL, String(MAIN_SIZE + 8));
    await expect.poll(async () => Number(await drawer.getInputValue(QUALIFIERS_LABEL))).toBeLessThanOrEqual(roomLeft);

    // 2. a second qualifying into round 1
    await drawer.setInputValue(STRUCTURE_NAME_LABEL, 'Qualifying B');
    await drawer.setInputValue(QUALIFIERS_LABEL, String(SECOND_QUALIFIERS));
    await drawer.clickGenerate();
    await drawer.waitForClose();

    await expect
      .poll(async () => (await readTargets(page, drawId, mainStructureId)).targets[0].promisedQualifiers, {
        timeout: 10_000,
      })
      .toBe(FIRST_QUALIFIERS + SECOND_QUALIFIERS);
    const after = await readTargets(page, drawId, mainStructureId);
    const feeders = after.targets[0].feedingStructures
      .map((f: any) => f.structureName)
      .sort((a: string, b: string) => a.localeCompare(b));
    expect(feeders).toEqual(['Qualifying', 'Qualifying B']);
    expect(after.targets[0].structuralCapacity).toBe(MAIN_SIZE - FIRST_QUALIFIERS - SECOND_QUALIFIERS);
    expect(after.targets[0].remainingCapacity).toBe(roomLeft - SECOND_QUALIFIERS);
  });

  test('a FEED_IN main offers its feed round, and the chosen round lands on the link', async ({ page }) => {
    await boot(page);
    const { tournamentId, drawId, mainStructureId } = await seed(
      page,
      { drawType: 'FEED_IN', drawSize: 12 },
      'e2e-add-qualifying-feed-in',
      // every position emptied, so both round 1 and the feed round are open
      { withdraw: 12 },
    );
    const before = await readTargets(page, drawId, mainStructureId);
    const feedRound = before.targets.find((t: any) => t.roundNumber > 1);
    expect(feedRound).toBeDefined();

    await openDrawView(page, tournamentId);
    const drawer = await openAddQualifying(page);
    await drawer.expectFieldVisible(TARGET_ROUND_LABEL);
    const rounds = await drawer.getSelectOptionValues(TARGET_ROUND_LABEL);
    expect(rounds).toEqual(before.targets.map((t: any) => String(t.roundNumber)));

    await drawer.fieldSelect(TARGET_ROUND_LABEL).selectOption(String(feedRound.roundNumber));
    await expect(page.locator(NOTICE)).toContainText(`Round ${feedRound.roundNumber}`);
    await drawer.setInputValue(QUALIFIERS_LABEL, String(feedRound.remainingCapacity));
    await drawer.clickGenerate();
    await drawer.waitForClose();

    await expect
      .poll(
        async () => (await readLinks(page, drawId)).some((l: any) => l.target.roundNumber === feedRound.roundNumber),
        {
          timeout: 10_000,
        },
      )
      .toBe(true);
    const after = await readTargets(page, drawId, mainStructureId);
    expect(after.targets.find((t: any) => t.roundNumber === feedRound.roundNumber)?.structuralCapacity).toBe(0);
  });

  test('a full main offers no qualifying, and a freed position can be marked QUALIFIER', async ({ page }) => {
    await boot(page);
    // CA's production case: every position filled, then a qualifying of 8 attached
    const { tournamentId, drawId, mainStructureId } = await seed(
      page,
      { drawType: 'SINGLE_ELIMINATION', drawSize: MAIN_SIZE, participantsCount: MAIN_SIZE },
      'e2e-add-qualifying-full',
      { attachQualifiers: 8 },
    );
    const before = await readTargets(page, drawId, mainStructureId);
    expect(before.targets[0].structuralCapacity).toBe(MAIN_SIZE - 8);
    expect(before.targets[0].remainingCapacity).toBe(0);
    expect(before.targets[0].owedQualifiers).toBe(8);

    await openDrawView(page, tournamentId);
    await openMainStructureMenu(page);
    // CONTROL: the menu is open, so the missing item is absence and not a closed menu
    await expect(page.locator('.dropdown-menu .dropdown-item', { hasText: 'Add playoffs' }).first()).toBeVisible();
    await expect(addQualifyingItem(page)).toHaveCount(0);
    await page.keyboard.press('Escape');

    const menu = page.locator('.tippy-box[data-state="visible"]');
    const openPositionMenu = async (drawPosition: number) => {
      await page.locator(`${S.DRAW_FRAME} [data-draw-position="${drawPosition}"] .tmx-i`).first().click();
      await expect(menu).toBeVisible({ timeout: 10_000 });
    };
    const assignment = (drawPosition: number) =>
      page.evaluate(
        ({ structureId, drawPosition }) =>
          dev
            .getTournament()
            .events[0].drawDefinitions[0].structures.find((s: any) => s.structureId === structureId)
            .positionAssignments.find((pa: any) => pa.drawPosition === drawPosition),
        { structureId: mainStructureId, drawPosition },
      );

    // a filled position offers no placeholder
    await openPositionMenu(1);
    await expect(menu.getByText('Remove assignment', { exact: true })).toBeVisible();
    await expect(menu.getByText(PLACEHOLDER, { exact: true })).toHaveCount(0);
    await menu.getByText('Remove assignment', { exact: true }).click();
    await expect.poll(async () => (await assignment(1))?.participantId ?? null).toBeNull();

    // the freed position can be handed to the qualifying that feeds the main
    await openPositionMenu(1);
    await menu.getByText(PLACEHOLDER, { exact: true }).click();
    await expect.poll(async () => (await assignment(1))?.qualifier ?? false).toBe(true);
  });
});
