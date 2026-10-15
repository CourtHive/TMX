/**
 * Journey 150 — Settings → Pipeline features: exit-propagation options for testing
 *
 * CA (2026-10-15): "a settings panel under 'Beta features' => 'Pipeline features' that is only on when not
 * logged in or when a tournamentRecord has the 'isMock' flag"; "a previously attached scoring policy disables
 * the settings panel"; mock tournaments run locally while it is in use.
 *
 * The result is entered through the real `dev.mutationRequest`, so the panel's per-call options are carried by
 * the same path every score in TMX takes.
 */
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';
import { test, expect, type Page } from '@playwright/test';
import { enterScore } from '../helpers/enterScore';

const PANEL = '#pipelineFeaturesPanel';
const BADGE = '#pipelineFeaturesBadge';
const option = (key: string) => `${PANEL} select[data-pipeline-option="${key}"]`;

/** An 8-draw FIRST_MATCH_LOSER_CONSOLATION mock; `policy` attaches a scoring policy of the tournament's own. */
async function seed(page: Page, policy?: 'USTA'): Promise<string> {
  return page.evaluate(async (policy) => {
    await dev.tmx2db.initDB();
    const factory: any = dev.factory;
    const tournamentId = `e2e-pipeline-features-${policy ?? 'plain'}`;
    factory.mocksEngine.generateTournamentRecord({
      tournamentAttributes: { tournamentId },
      tournamentName: 'E2E Pipeline Features',
      drawProfiles: [{ drawSize: 8, drawType: 'FIRST_MATCH_LOSER_CONSOLATION' }],
      setState: true,
      nonRandom: 1,
    });
    if (policy)
      factory.tournamentEngine.attachPolicies({ policyDefinitions: factory.fixtures.policies.POLICY_SCORING_USTA });
    await dev.load({ tournamentRecord: factory.tournamentEngine.getTournament().tournamentRecord });
    return tournamentId;
  }, policy);
}

/** Main round 1, position 1 — and the consolation matchUp its loser feeds. */
function firstMatchUp(page: Page) {
  return page.evaluate(() => {
    const matchUps = dev.factory.tournamentEngine.allTournamentMatchUps().matchUps;
    const main = matchUps.find((m: any) => m.structureName === 'Main' && m.roundNumber === 1 && m.roundPosition === 1);
    return { matchUpId: main.matchUpId, drawId: main.drawId };
  });
}

function consolationStatus(page: Page) {
  return page.evaluate(() => {
    const matchUps = dev.factory.tournamentEngine.allTournamentMatchUps().matchUps;
    return matchUps.find((m: any) => m.structureName !== 'Main' && m.roundNumber === 1 && m.roundPosition === 1)
      ?.matchUpStatus;
  });
}

async function openSettings(page: Page, tournamentId: string): Promise<void> {
  const tournamentPage = new TournamentPage(page);
  await tournamentPage.goto(tournamentId);
  await tournamentPage.navigateToSettings();
}

test.describe('Journey 150 — Pipeline features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => globalThis.localStorage.removeItem('tmx_settings'));
  });

  test('sits with the full-width panels, directly after Seeding policy', async ({ page }) => {
    // CA, 2026-10-15: a full-width panel in the middle of the column grid "looks UGLY" — it goes 2nd or 3rd.
    const tournamentId = await seed(page);
    await openSettings(page, tournamentId);

    await expect(page.locator(`#seedingPolicyPanel + ${PANEL}`)).toBeVisible();
  });

  test('default: a main-draw walkover leaves the consolation match to be played', async ({ page }) => {
    const tournamentId = await seed(page);
    await openSettings(page, tournamentId);
    await expect(page.locator(option('propagateExitStatus'))).toHaveValue('default');
    await expect(page.locator(BADGE)).toHaveCount(0);

    await enterScore(page, { ...(await firstMatchUp(page)), matchUpStatus: 'WALKOVER' });

    expect(await consolationStatus(page)).toBe('TO_BE_PLAYED');
  });

  test('Propagate exit status ON: the walkover follows the loser into the consolation', async ({ page }) => {
    const tournamentId = await seed(page);
    await openSettings(page, tournamentId);

    await page.locator(option('propagateExitStatus')).selectOption('on');
    await expect(page.locator(BADGE), 'modified rules are announced beside the name').toBeVisible();

    await enterScore(page, { ...(await firstMatchUp(page)), matchUpStatus: 'WALKOVER' });

    expect(await consolationStatus(page)).toBe('WALKOVER');
  });

  test('a policy option attaches a marked policy to the tournament, and Default removes it', async ({ page }) => {
    const tournamentId = await seed(page);
    await openSettings(page, tournamentId);
    const progression = () =>
      page.evaluate(
        () => dev.getTournament().extensions?.find((x: any) => x.name === 'appliedPolicies')?.value?.progression,
      );

    await page.locator(option('doubleExitPropagateBye')).selectOption('off');
    await expect
      .poll(progression)
      .toMatchObject({ policyName: 'TMX Pipeline Features', doubleExitPropagateBye: false });
    await expect(page.locator(option('doubleExitPropagateBye'))).toHaveValue('off');
    await expect(page.locator(BADGE)).toBeVisible();

    await page.locator(option('doubleExitPropagateBye')).selectOption('default');
    await expect.poll(progression).toBeUndefined();
    await expect(page.locator(BADGE)).toHaveCount(0);
  });

  test("a scoring policy of the tournament's own turns the panel off", async ({ page }) => {
    const tournamentId = await seed(page, 'USTA');
    await openSettings(page, tournamentId);

    await expect(page.locator(PANEL)).toContainText('own scoring policy');
    await expect(page.locator(`${PANEL} select`)).toHaveCount(0);
  });
});
