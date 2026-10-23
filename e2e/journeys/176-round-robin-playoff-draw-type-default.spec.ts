/**
 * Journey 176 — a ROUND_ROBIN_WITH_PLAYOFF draw made with the drawer's playoff defaults builds its playoffs
 *
 * Found by journey 175 (#1725(TMX)): the "Playoff Draw Type" select opened on its disabled divider
 * ('──────────'), whose label became every playoff group's `drawType`, and the factory returned success with
 * only the 'Main' structure. The select's own "Playoff" option had the same effect: its value was `PLAY_OFF`,
 * a stage, not the draw type `PLAYOFF`.
 *
 * Each draw is made in the add-draw drawer (16 entries, groups of 4, Playoff Type "Positions") and asserted on
 * the structures the held record contains.
 */
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, type MockProfile } from '../helpers/seed';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';
import { DrawFormDrawer } from '../pages/DrawFormDrawer';

const ENTRIES = 16;
const GROUP_SIZE = 4;
const PLAYOFF_NAMES = ['Playoff 1', 'Playoff 2', 'Playoff 3', 'Playoff 4'];

const PROFILE_EVENT_NO_DRAW: MockProfile = {
  tournamentName: 'E2E RR Playoff Draw Type Default',
  tournamentAttributes: { tournamentId: 'e2e-rr-playoff-draw-type-default' },
  participantsProfile: { scaledParticipantsCount: ENTRIES },
  drawProfiles: [{ eventName: 'Singles', drawSize: ENTRIES, generate: false }],
};

type PlayoffState = { drawType?: string; playoffs: { structureName: string }[] };

async function playoffState(page: Page): Promise<PlayoffState> {
  return page.evaluate(() => {
    const draw = dev.getTournament().events[0].drawDefinitions?.[0];
    const playoffs = (draw?.structures ?? [])
      .filter((s: any) => s.stage === 'PLAY_OFF')
      .map((s: any) => ({ structureName: s.structureName }));
    return { drawType: draw?.drawType, playoffs };
  });
}

/** Open the add-draw drawer on a 16-entry event with no draw and set up a RR-with-playoff by Positions. */
async function openRoundRobinWithPlayoff(page: Page): Promise<DrawFormDrawer> {
  const tournamentId = await seedTournament(page, PROFILE_EVENT_NO_DRAW);
  const tournamentPage = new TournamentPage(page);
  await tournamentPage.goto(tournamentId);
  await tournamentPage.navigateToEvents();
  await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
  await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
  await page.getByRole('button', { name: 'Add draw' }).click();

  const drawer = new DrawFormDrawer(page);
  await drawer.waitForOpen();
  await drawer.selectDrawType('ROUND_ROBIN_WITH_PLAYOFF');
  await drawer.fieldSelect('Group size').selectOption(String(GROUP_SIZE));
  await drawer.fieldSelect('Playoff Type').selectOption('positions');
  return drawer;
}

async function generate(page: Page, drawer: DrawFormDrawer): Promise<PlayoffState> {
  await drawer.clickGenerate();
  await drawer.waitForClose();
  await expect
    .poll(async () => (await playoffState(page)).drawType, { timeout: 10_000 })
    .toBe('ROUND_ROBIN_WITH_PLAYOFF');
  return playoffState(page);
}

test.describe('Journey 176 — round robin playoff draw type default', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('the drawer defaults create a playoff per finishing position', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept());
    const drawer = await openRoundRobinWithPlayoff(page);
    // "Playoff Draw Type" is left untouched
    await expect(drawer.fieldSelect('Playoff Draw Type')).toHaveValue('SINGLE_ELIMINATION');

    const { playoffs } = await generate(page, drawer);
    expect(playoffs.map((s) => s.structureName).sort()).toEqual(PLAYOFF_NAMES);
  });

  test('choosing "Playoff" builds playoff structures', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept());
    const drawer = await openRoundRobinWithPlayoff(page);
    await drawer.fieldSelect('Playoff Draw Type').selectOption('PLAYOFF');

    const { playoffs } = await generate(page, drawer);
    // every finishing position gets its own playoff, which plays off all its places
    const names = playoffs.map((s) => s.structureName);
    for (const name of PLAYOFF_NAMES) expect(names.some((n) => n.startsWith(name))).toBe(true);
  });
});
