import { ensureDrawsTableMode, initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/**
 * Journey 141 — Add playoffs can cap the rounds of the structure it adds.
 *
 * A playoff for the losers of a round was always a full tree: 32 losers played five rounds to one
 * winner. A consolation usually plays one or two, and until the factory's `roundLimits`
 * (CourtHive/competition-factory#5282) nothing in the UI could say so. The modal now offers, per
 * checked range, a Rounds select: All, or a cap below the natural depth.
 *
 * Two shapes, both from the structure menu:
 *  1. a 32 main: the round-1 losers' range capped at 2 rounds → a 16-position structure with
 *     rounds 1 and 2 only, `roundLimit: 2` recorded;
 *  2. the case this exists for: a 64 qualifying feeding a 64 main, viewed on Qualifying, its
 *     round-1 losers capped at 1 round → a 32-position, 16-matchUp consolation.
 */
const ADD_PLAYOFFS = 'Add playoffs';
const ADD_BUTTON = 'Add';
const MODAL_DIALOG = '.chc-modal-dialog';

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);
  await ensureDrawsTableMode(page);
}

async function seed(page: Page, drawProfile: Record<string, unknown>, tournamentId: string): Promise<string> {
  return page.evaluate(
    async ({ drawProfile, tournamentId }) => {
      await dev.tmx2db.initDB();
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        tournamentAttributes: { tournamentId },
        drawProfiles: [{ eventName: 'Singles', ...drawProfile }],
        tournamentName: 'E2E Playoff Rounds',
        setState: true,
        nonRandom: 1,
      });
      await dev.load({ tournamentRecord });
      return tournamentRecord.events[0].drawDefinitions[0].drawId as string;
    },
    { drawProfile, tournamentId },
  );
}

async function readStructures(page: Page, drawId: string): Promise<any[]> {
  return page.evaluate((id) => {
    const dd = dev.factory.tournamentEngine.getEvent({ drawId: id }).drawDefinition;
    return (dd?.structures ?? []).map((s: any) => ({
      rounds: [...new Set((s.matchUps ?? []).map((m: any) => m.roundNumber))].sort((a: any, b: any) => a - b),
      positions: s.positionAssignments?.length ?? 0,
      matchUps: s.matchUps?.length ?? 0,
      structureName: s.structureName,
      roundLimit: s.roundLimit,
      stage: s.stage,
    }));
  }, drawId);
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

/** View `structureName`, then open Add playoffs from the structure menu. */
async function openAddPlayoffs(page: Page, structureName: string) {
  const eventControl = page.locator(S.EVENT_CONTROL);
  await eventControl.waitFor({ state: 'visible', timeout: 5_000 });
  const structureMenu = eventControl.locator(`.dropdown:has-text("${structureName}")`).first();
  await structureMenu.locator('.dropdown-trigger').first().click();
  await page
    .locator('.dropdown-menu .dropdown-item', { hasText: new RegExp(`^${structureName}$`) })
    .first()
    .click();
  await expect(structureMenu.locator('.dropdown-trigger')).toContainText(structureName);
  await structureMenu.locator('.dropdown-trigger').first().click();
  await page.locator('.dropdown-menu .dropdown-item', { hasText: ADD_PLAYOFFS }).first().click();
  const modal = page.locator(MODAL_DIALOG).filter({ hasText: 'playoff' });
  await expect(modal).toBeVisible();
  return modal;
}

async function capRange(page: Page, modal: any, range: string, rounds: string): Promise<void> {
  // ids like "17-32-rounds" need an attribute selector, not a #id one
  // the id sits on the field wrapper; the control is the <select> inside it
  const roundsField = modal.locator(`[id="${range}-rounds"]`);
  const roundsSelect = roundsField.locator('select');
  // the cap is offered only once the range is checked
  await expect(roundsField).toBeHidden();
  // a Bulma checkradio hides its input; the operator clicks the label
  await modal.locator(`label[for="${range}"]`).click();
  await expect(modal.locator(`[id="${range}"]`)).toBeChecked();
  await expect(roundsSelect).toBeVisible();
  const offered = await roundsSelect
    .locator('option')
    .evaluateAll((options: HTMLOptionElement[]) => options.map((option) => option.value));
  expect(offered[0]).toBe('');
  expect(offered).toContain(rounds);
  await roundsSelect.selectOption(rounds);
  await modal.getByRole('button', { name: ADD_BUTTON, exact: true }).click();
}

test.describe('journey 141 — add playoffs with a rounds cap', () => {
  test('round-1 losers of a 32 main capped at two rounds', async ({ page }) => {
    await boot(page);
    const drawId = await seed(page, { drawType: 'SINGLE_ELIMINATION', drawSize: 32 }, 'e2e-playoff-rounds-main');
    await openDrawView(page, 'e2e-playoff-rounds-main');
    const modal = await openAddPlayoffs(page, 'Main');
    await capRange(page, modal, '17-32', '2');

    await expect
      .poll(async () => (await readStructures(page, drawId)).filter((s) => s.stage === 'PLAY_OFF').length, {
        timeout: 10_000,
      })
      .toBe(1);
    const playoff = (await readStructures(page, drawId)).find((s) => s.stage === 'PLAY_OFF')!;
    expect(playoff.positions).toBe(16);
    expect(playoff.rounds).toEqual([1, 2]);
    expect(playoff.matchUps).toBe(12);
    expect(playoff.roundLimit).toBe(2);
  });

  test('a one-round consolation for the losers of qualifying round 1', async ({ page }) => {
    await boot(page);
    const drawId = await seed(
      page,
      {
        qualifyingProfiles: [{ roundTarget: 1, structureProfiles: [{ drawSize: 64, qualifyingPositions: 16 }] }],
        drawType: 'SINGLE_ELIMINATION',
        drawSize: 64,
      },
      'e2e-playoff-rounds-qualifying',
    );
    await openDrawView(page, 'e2e-playoff-rounds-qualifying');
    const modal = await openAddPlayoffs(page, 'Qualifying');
    await capRange(page, modal, '33-64', '1');

    await expect
      .poll(async () => (await readStructures(page, drawId)).filter((s) => s.stage === 'PLAY_OFF').length, {
        timeout: 10_000,
      })
      .toBe(1);
    const consolation = (await readStructures(page, drawId)).find((s) => s.stage === 'PLAY_OFF')!;
    expect(consolation.positions).toBe(32);
    expect(consolation.rounds).toEqual([1]);
    expect(consolation.matchUps).toBe(16);
    expect(consolation.roundLimit).toBe(1);
  });
});
