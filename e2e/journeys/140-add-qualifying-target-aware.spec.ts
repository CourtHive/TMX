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
 * The factory answers with `getAvailableQualifyingTargets`; the form reads it. Asserted here:
 *  1. with a qualifying already feeding round 1 of a 32 main, the form says so by name and count
 *     and caps the qualifiers at the 28 positions the round can still take;
 *  2. submitting a second qualifying attaches it, and the factory then reports both feeders and
 *     the aggregate they promise;
 *  3. a FEED_IN main offers its feed round as a target, and the chosen round lands on the link.
 */
const MAIN_SIZE = 32;
const FIRST_QUALIFIERS = 4;
const SECOND_QUALIFIERS = 4;
const QUALIFIERS_LABEL = 'Qualifiers';
const STRUCTURE_NAME_LABEL = 'Structure name';
const TARGET_ROUND_LABEL = 'Target round';
const ADD_QUALIFYING = 'Add qualifying';
const NOTICE = '#qualifyingTargetNotice';

type Seeded = { tournamentId: string; drawId: string; mainStructureId: string };

async function seed(page: Page, drawProfile: Record<string, unknown>, tournamentId: string): Promise<Seeded> {
  return page.evaluate(
    async ({ drawProfile, tournamentId }) => {
      await dev.tmx2db.initDB();
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        tournamentAttributes: { tournamentId },
        drawProfiles: [{ eventName: 'Singles', ...drawProfile }],
        tournamentName: 'E2E Add Qualifying',
        setState: true,
        nonRandom: 1,
      });
      await dev.load({ tournamentRecord });
      const draw: any = tournamentRecord.events[0].drawDefinitions[0];
      const main = draw.structures.find((s: any) => s.stage === 'MAIN');
      return { tournamentId: tournamentRecord.tournamentId, drawId: draw.drawId, mainStructureId: main.structureId };
    },
    { drawProfile, tournamentId },
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

async function openAddQualifying(page: Page): Promise<DrawFormDrawer> {
  const eventControl = page.locator(S.EVENT_CONTROL);
  await eventControl.waitFor({ state: 'visible', timeout: 5_000 });
  // the menu lists every structure and acts on the one being VIEWED: with a qualifying present the
  // view may open on it, so select Main first, then reopen the menu for the action
  const structureMenu = eventControl.locator('.dropdown:has-text("Main")').first();
  await structureMenu.locator('.dropdown-trigger').first().click();
  await page
    .locator('.dropdown-menu .dropdown-item', { hasText: /^Main$/ })
    .first()
    .click();
  await expect(structureMenu.locator('.dropdown-trigger')).toContainText('Main');
  await structureMenu.locator('.dropdown-trigger').first().click();
  // scoped to the open menu: the text also appears elsewhere on the page
  const item = page.locator('.dropdown-menu .dropdown-item', { hasText: ADD_QUALIFYING }).first();
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
    );
    // CONTROL: the factory sees one feeder before the form is opened; otherwise the notice assertion is vacuous
    const before = await readTargets(page, drawId, mainStructureId);
    expect(before.targets.map((t: any) => t.roundNumber)).toEqual([1]);
    expect(before.targets[0].promisedQualifiers).toBe(FIRST_QUALIFIERS);
    const roomLeft = MAIN_SIZE - FIRST_QUALIFIERS;
    expect(before.targets[0].structuralCapacity).toBe(roomLeft);

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
  });

  test('a FEED_IN main offers its feed round, and the chosen round lands on the link', async ({ page }) => {
    await boot(page);
    const { tournamentId, drawId, mainStructureId } = await seed(
      page,
      { drawType: 'FEED_IN', drawSize: 12 },
      'e2e-add-qualifying-feed-in',
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
    await drawer.setInputValue(QUALIFIERS_LABEL, String(feedRound.structuralCapacity));
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
});
