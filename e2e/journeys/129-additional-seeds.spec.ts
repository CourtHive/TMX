/**
 * Journey 129 — Additional seeds
 *
 * A governing body may award a seeding to a player whose ranking does not reach the draw's seed
 * count on its own — most often a protected ranking after a long absence. The seed is added OVER
 * AND ABOVE the normal count, so nobody who earned a seeding slot loses one.
 *
 * Two halves, both of which are DOM and neither of which a unit test can reach:
 *
 *  1. The draw form offers the counts the policy permits, labelled as additional. Before
 *     `additionalSeeds` existed, `resolveSeedsCount` snapped any value not on the power-of-two list
 *     DOWN in silence — so a policy permitting 8 + 2 could not be expressed at all, and the
 *     operator saw a draw that looked right.
 *  2. The draw view grants one, records WHY, and then says so. `seedingBasis` is what makes the
 *     seed self-describing when somebody later asks why there is a ninth of them.
 *
 * @see src/components/drawers/addDraw/seedCount.ts, src/components/popovers/additionalSeedContext.ts
 * @see factory documentation/docs/concepts/additional-seeds.md
 */
import { ensureDrawsTableMode, initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { seedTournament, MockProfile } from '../helpers/seed';
import { DrawFormDrawer } from '../pages/DrawFormDrawer';
import { TournamentPage } from '../pages/TournamentPage';
import { test, expect } from '@playwright/test';
import { S } from '../helpers/selectors';

/* ─── Seed profiles ─────────────────────────────────────────────────────── */

/** 32 participants entered into a singles event with no draw yet — the draw form opens in NEW_MAIN. */
const PROFILE_NO_DRAW: MockProfile = {
  tournamentName: 'E2E Additional Seeds',
  tournamentAttributes: { tournamentId: 'e2e-additional-seeds' },
  participantsProfile: { scaledParticipantsCount: 32 },
  drawProfiles: [{ eventName: 'Singles', drawSize: 32, generate: false }],
};

/* ─── Helpers ───────────────────────────────────────────────────────────── */

/**
 * Attach a seeding policy carrying an `additionalSeeds` allowance to the TOURNAMENT.
 *
 * Attaching it here rather than passing it to the draw is the case that matters: the form resolves
 * an INHERIT policy through the factory, which is the only way it can see an allowance a provider
 * or governing body declared. Substituting TMX's default asset would report an allowance of 0 and
 * quietly hide the feature from exactly the operators it exists for.
 */
async function attachAllowancePolicy(page: any, maxCount: number, bases?: string[]) {
  await page.evaluate(
    ({ maxCount, bases }: any) => {
      const factory = dev.factory;
      const POLICY_TYPE_SEEDING = factory.policyConstants.POLICY_TYPE_SEEDING;
      const base = factory.fixtures.policies.POLICY_SEEDING_ITF[POLICY_TYPE_SEEDING];
      factory.tournamentEngine.attachPolicies({
        policyDefinitions: {
          [POLICY_TYPE_SEEDING]: {
            ...base,
            additionalSeeds: { maxCount, ...(bases ? { bases } : {}) },
          },
        },
      });
    },
    { maxCount, bases },
  );
}

async function openDrawForm(page: any): Promise<DrawFormDrawer> {
  const tournamentPage = new TournamentPage(page);
  await tournamentPage.navigateToEvents();
  await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
  await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
  await page.getByRole('button', { name: 'Add draw' }).click();
  const drawer = new DrawFormDrawer(page);
  await drawer.waitForOpen();
  return drawer;
}

/**
 * A generated 32-draw whose SEEDING POLICY carries the allowance.
 *
 * The policy goes in at GENERATION, not afterwards. A drawDefinition carries its own seeding policy
 * once generated, and the hierarchy resolves the most specific one — so a tournament-level attach
 * made after the fact is shadowed and the allowance reads 0. Correct behaviour, and the reason the
 * draw-form tests attach BEFORE any draw exists.
 */
async function seedWithAllowance(page: any, tournamentId: string): Promise<string> {
  return page.evaluate((tournamentId: string) => {
    const factory = dev.factory;
    const POLICY_TYPE_SEEDING = factory.policyConstants.POLICY_TYPE_SEEDING;
    const base = factory.fixtures.policies.POLICY_SEEDING_ITF[POLICY_TYPE_SEEDING];
    const { tournamentRecord } = factory.mocksEngine.generateTournamentRecord({
      nonRandom: 1,
      setState: true,
      tournamentAttributes: { tournamentId },
      participantsProfile: { scaledParticipantsCount: 32 },
      drawProfiles: [
        {
          policyDefinitions: {
            [POLICY_TYPE_SEEDING]: { ...base, additionalSeeds: { maxCount: 2, bases: ['PROTECTED_RANKING'] } },
          },
          eventName: 'Singles',
          participantsCount: 32,
          seedsCount: 8,
          drawSize: 32,
        },
      ],
    });
    return dev.load(tournamentRecord).then(() => tournamentRecord.tournamentId as string);
  }, tournamentId);
}

/* ─── Tests ─────────────────────────────────────────────────────────────── */

test.describe('Journey 129 — additional seeds', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await ensureDrawsTableMode(page);
  });

  test('the seed count dropdown offers only structural counts without an allowance', async ({ page }) => {
    // The control. ITF gives 8 seeds at drawSize 32; the rest of the list is the form's own
    // structural offer of deeper seeding as an override.
    const tournamentId = await seedTournament(page, PROFILE_NO_DRAW);
    await new TournamentPage(page).goto(tournamentId);
    const drawer = await openDrawForm(page);

    expect(await drawer.getSelectOptionValues('Seed count')).toEqual(['', '0', '2', '4', '8', '16']);
  });

  test('an allowance adds the counts it permits, in order and labelled', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_NO_DRAW);
    await attachAllowancePolicy(page, 2);
    await new TournamentPage(page).goto(tournamentId);
    const drawer = await openDrawForm(page);

    // 9 and 10 sit between 8 and 16 rather than after them. A dropdown that counts upwards and then
    // jumps backwards makes the two entries that need to be noticed read as a mistake.
    expect(await drawer.getSelectOptionValues('Seed count')).toEqual(['', '0', '2', '4', '8', '9', '10', '16']);

    const labels = await drawer.getSelectOptionLabels('Seed count');
    expect(labels).toContain('9 (+1 additional seed)');
    expect(labels).toContain('10 (+2 additional seeds)');
    // and the counts the policy reaches on its own stay bare
    expect(labels).toContain('8');
  });

  test('generating with an additional count keeps the policy in force', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_NO_DRAW);
    await attachAllowancePolicy(page, 2);
    await new TournamentPage(page).goto(tournamentId);
    const drawer = await openDrawForm(page);

    const collector = createMutationCollector(page);
    await drawer.fieldSelect('Seed count').selectOption('10');
    await drawer.clickGenerate();

    // Read the SUBMITTED mutation rather than the state afterwards: it is race-free, and it is the
    // only place the absence of `enforcePolicyLimits` is visible. The generated draw would look
    // identical either way — 10 seeds — which is exactly why asserting the outcome alone would not
    // catch the ceiling being lifted to obtain a seat the ceiling already grants.
    const entry = await collector.waitForMethod('addDrawDefinition', 10_000);
    const params: any = entry.methods[0].params;
    expect(params.drawDefinition.structures[0].seedLimit).toEqual(10);
    expect(params.enforcePolicyLimits).toBeUndefined();
    collector.detach();

    await drawer.waitForClose();

    // 10 is delivered — NOT clamped back to the policy's 8.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const structure = dev.getTournament()?.events?.[0]?.drawDefinitions?.[0]?.structures?.[0];
          return structure?.seedAssignments?.length ?? 0;
        }),
      )
      .toEqual(10);
  });

  test('additional seeds displace nobody', async ({ page }) => {
    // The claim the whole feature rests on, and the one an operator will not believe until they see
    // it. The eight seeds the draw would have had occupy the same eight drawPositions whether or
    // not two more exist; the extras take positions from the NEXT seed block.
    //
    // `nonRandom: 1` is what makes this assertable — seedTournament passes it, so positioning is
    // deterministic across both generations.
    const positionsFor = async (seedsCount: number) =>
      page.evaluate((seedsCount: number) => {
        const factory = dev.factory;
        const POLICY_TYPE_SEEDING = factory.policyConstants.POLICY_TYPE_SEEDING;
        const base = factory.fixtures.policies.POLICY_SEEDING_ITF[POLICY_TYPE_SEEDING];
        const policyDefinitions = {
          [POLICY_TYPE_SEEDING]: { ...base, additionalSeeds: { maxCount: 2 } },
        };
        const { tournamentRecord } = factory.mocksEngine.generateTournamentRecord({
          nonRandom: 1,
          drawProfiles: [{ drawSize: 32, participantsCount: 32, seedsCount, policyDefinitions }],
        });
        const structure = tournamentRecord.events[0].drawDefinitions[0].structures[0];
        const positions = structure.positionAssignments;
        return structure.seedAssignments
          .map(
            (assignment: any) =>
              positions.find((position: any) => position.participantId === assignment.participantId)?.drawPosition,
          )
          .filter(Boolean);
      }, seedsCount);

    const baseline = await positionsFor(8);
    const extended = await positionsFor(10);

    expect(baseline).toHaveLength(8);
    expect(extended).toHaveLength(10);
    // compare SETS — which position a seed draws within its block is random even under nonRandom
    const sorted = (values: number[]) => [...values].sort((a, b) => a - b);
    expect(sorted(extended.slice(0, 8))).toEqual(sorted(baseline));
  });

  test('the draw view grants an additional seed and then says why it exists', async ({ page }) => {
    // The policy goes in at GENERATION, not afterwards. A drawDefinition carries its own seeding
    // policy once generated, and the policy hierarchy resolves the most specific one — so a
    // tournament-level attach made after the fact is shadowed and the allowance reads 0. Correct
    // behaviour, and the reason the draw-form tests above attach BEFORE any draw exists.
    const tournamentId = await seedWithAllowance(page, 'e2e-additional-seeds-draw');
    await new TournamentPage(page).goto(tournamentId);

    // The engine half of the action, driven exactly as the popover drives it. The popover itself is
    // exercised by its presence check below; what matters here is that the mutation lands and the
    // basis survives into the record a draw sheet would be printed from.
    const before = await page.evaluate(() => {
      const tournament = dev.getTournament();
      const structure = tournament.events[0].drawDefinitions[0].structures[0];
      const seeded = structure.seedAssignments.map((assignment: any) => assignment.participantId);
      const unseeded = structure.positionAssignments
        .map((assignment: any) => assignment.participantId)
        .filter(Boolean)
        .find((participantId: string) => !seeded.includes(participantId));
      return {
        drawId: tournament.events[0].drawDefinitions[0].drawId,
        structureId: structure.structureId,
        seedLimit: structure.seedLimit,
        unseeded,
      };
    });
    expect(before.seedLimit).toEqual(8);

    const result = await page.evaluate(
      ({ drawId, structureId, unseeded }: any) =>
        dev.factory.tournamentEngine.addAdditionalSeed({
          seedingBasis: 'PROTECTED_RANKING',
          participantId: unseeded,
          structureId,
          drawId,
        }),
      before,
    );
    expect(result.success).toEqual(true);
    expect(result.seedNumber).toEqual(9);

    const after = await page.evaluate(() => {
      const structure = dev.getTournament().events[0].drawDefinitions[0].structures[0];
      const added = structure.seedAssignments.find((assignment: any) => assignment.seedNumber === 9);
      return {
        seedLimit: structure.seedLimit,
        seedingBasis: added?.seedingBasis,
        earlierSeeds: structure.seedAssignments
          .filter((assignment: any) => assignment.seedNumber <= 8)
          .map((assignment: any) => assignment.participantId),
      };
    });

    expect(after.seedLimit).toEqual(9);
    expect(after.seedingBasis).toEqual('PROTECTED_RANKING');
    expect(after.earlierSeeds.filter(Boolean)).toHaveLength(8);

    // and the allowance now reports one seat left, which is what hides the control at zero
    const allowance = await page.evaluate(
      ({ drawId, structureId }: any) =>
        dev.factory.tournamentEngine.getAdditionalSeedsAllowance({ structureId, drawId }),
      before,
    );
    expect(allowance.additionalSeedsAssigned).toEqual(1);
    expect(allowance.additionalSeedsRemaining).toEqual(1);
  });

  test('the position popover offers it, grants it, and afterwards says why the seed exists', async ({ page }) => {
    // The popover is DOM-only code: the label, the two-step basis choice, and the title that
    // reports an existing basis exist nowhere a unit test can reach.
    const tournamentId = await seedWithAllowance(page, 'e2e-additional-seeds-popover');

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToEvents();
    await page.locator(`${S.EVENTS_TABLE} .tabulator-row`).first().click();
    await expect(page.locator(S.DRAW_FRAME)).toBeVisible({ timeout: 10_000 });

    // An UNSEEDED participant. A seeded one is offered nothing, which is the point of the guard —
    // so clicking one would prove only that nothing happened. Addressed by drawPosition rather than
    // by name: the draw renders each participant's name across several `.tmx-i` nodes, so a
    // text-matched locator resolves to a chain rather than to the clickable element.
    const drawPosition = await page.evaluate(() => {
      const structure = dev.getTournament().events[0].drawDefinitions[0].structures[0];
      const seeded = structure.seedAssignments.map((assignment: any) => assignment.participantId);
      return structure.positionAssignments.find(
        (position: any) => position.participantId && !seeded.includes(position.participantId),
      )?.drawPosition;
    });
    expect(drawPosition).toBeTruthy();

    // Scoped to the VISIBLE tippy: the nav bar keeps its own hidden tooltip mounted, so a bare
    // `.tippy-box` is a strict-mode violation rather than a miss.
    const menu = page.locator('.tippy-box[data-state="visible"]');
    const openPopover = async () => {
      await page.locator(`${S.DRAW_FRAME} [data-draw-position="${drawPosition}"] .tmx-i`).first().click();
      await expect(menu).toBeVisible({ timeout: 10_000 });
    };

    await openPopover();
    const seedAsAdditional = menu.getByText('Seed as additional', { exact: true });
    await expect(seedAsAdditional).toBeVisible({ timeout: 5_000 });
    await seedAsAdditional.click();

    // Second step: the bases the POLICY named, and only those. The policy declares
    // PROTECTED_RANKING alone, so organiser discretion must not be on offer.
    await expect(menu.getByText('Protected ranking', { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(menu.getByText('Organiser discretion', { exact: true })).toHaveCount(0);
    await menu.getByText('Protected ranking', { exact: true }).click();

    await expect
      .poll(() =>
        page.evaluate(() => {
          const structure = dev.getTournament().events[0].drawDefinitions[0].structures[0];
          return structure.seedAssignments.find((assignment: any) => assignment.seedNumber === 9)?.seedingBasis;
        }),
      )
      .toEqual('PROTECTED_RANKING');

    // Re-opening now reports the basis rather than offering another seat — the participant is
    // seeded, so the action is gone and the title says why their seed exists.
    await openPopover();
    await expect(menu).toContainText('Seeded on Protected ranking', { timeout: 5_000 });
    await expect(menu.getByText('Seed as additional', { exact: true })).toHaveCount(0);
  });
});