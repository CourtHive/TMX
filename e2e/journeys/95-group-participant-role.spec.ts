import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/**
 * Journey 95 — GROUP `participantRole`: the badge and the edit round-trip.
 *
 * A GROUP's role is the discriminator that escalates a SHARED_GROUPING conflict from WARN to BLOCK
 * (journey 94 is the other half). So a TD has to be able to both *see* which groups carry a blocking
 * relationship and *change* one when they learn about it — which is usually after the group exists.
 *
 * Both halves were broken when this journey was written, and both were invisible to the unit tests
 * that already covered the surface:
 *
 *   - `editGroupingParticipant.test.ts` calls the editor directly, so it proved the role select exists
 *     and dispatches correctly while nothing in the UI could open it for a GROUP: the row's three-dot
 *     menu offered only "Delete participant".
 *   - nothing asserted the groupings row shape, so `mapTeamParticipant` dropping `participantRole` left
 *     the badge column reading `undefined` on every row — visible column, populated record, empty cell.
 *
 * The lesson each encodes: assert the real call path, not the component in isolation.
 */

const TEAMS_TABLE = S.TOURNAMENT_TEAMS;
const ROWS = `${TEAMS_TABLE} .tabulator-row`;
// Relative on purpose — it is chained under a row locator, where an absolute `#tournamentTeams …`
// selector would be searched as a descendant of the row and never match.
const ROLE_CELL = '.tabulator-cell[tabulator-field="participantRole"]';

const COACH_GROUP = 'Coaching Group';
const NEUTRAL_GROUP = 'Training Squad';

/** Seed two GROUPs differing only in role: one COACH (blocking), one OTHER (the neutral default). */
async function seedGroups(page: Page): Promise<string> {
  return page.evaluate(
    async ({ coachGroup, neutralGroup }) => {
      await dev.tmx2db.initDB();

      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        tournamentName: 'E2E Group Roles',
        tournamentAttributes: { tournamentId: 'e2e-group-roles' },
        participantsProfile: { scaledParticipantsCount: 8 },
        drawProfiles: [{ eventName: 'Role Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
      });
      const tournamentId = tournamentRecord.tournamentId as string;

      const { participants } = dev.factory.tournamentEngine.getParticipants({
        participantFilters: { participantTypes: ['INDIVIDUAL'] },
      });
      const ids = participants.map((p: any) => p.participantId);

      const group = (individualParticipantIds: string[], groupName: string, participantRole: string) => {
        const created: any = dev.factory.tournamentEngine.createGroupParticipant({
          individualParticipantIds,
          participantRole,
          groupName,
          tournamentId,
        });
        if (!created?.success) throw new Error(`createGroupParticipant failed for ${groupName}`);
      };

      group(ids.slice(0, 2), coachGroup, dev.factory.participantRoles.COACH);
      group(ids.slice(2, 4), neutralGroup, dev.factory.participantRoles.OTHER);

      const mutated = dev.factory.tournamentEngine.getTournament().tournamentRecord;
      await dev.tmx2db.addTournament(mutated);
      return tournamentId;
    },
    { coachGroup: COACH_GROUP, neutralGroup: NEUTRAL_GROUP },
  );
}

/**
 * Navigate to the groupings table in GROUP view via the participant chips — the route the operator
 * takes. A hard `page.goto` of the same URL reloads the SPA before the seed has rehydrated and the
 * table renders empty.
 */
async function gotoGroupView(page: Page, tournamentId: string) {
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToParticipants();
  await page.locator('.participant-chip i.fa-users').first().click({ force: true });
  await expect(page.locator(ROWS).first()).toBeVisible({ timeout: 10_000 });
}

const groupRow = (page: Page, name: string) => page.locator(ROWS).filter({ hasText: name }).first();

/** Open a group row's three-dot menu. The tippy is created and shown inside the same cellClick, so the
 *  first click is consumed — poll rather than assume a count (journey 91). */
async function openRowMenu(page: Page, name: string) {
  const threeDots = groupRow(page, name).locator('.fa-ellipsis-vertical');
  const menu = page.locator('.tippy-content .menu-list');
  for (let attempt = 0; attempt < 4; attempt++) {
    if (await menu.isVisible().catch(() => false)) break;
    await threeDots.click({ force: true });
    await page.waitForTimeout(250);
  }
  await expect(menu).toBeVisible({ timeout: 5_000 });
  return menu;
}

test.describe('Journey 95 — GROUP participantRole badge + edit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('renders a badge for a blocking role and nothing for the neutral default', async ({ page }) => {
    const tournamentId = await seedGroups(page);
    await gotoGroupView(page, tournamentId);

    // The role column is GROUP-only; prove it is actually on screen before reading cells, so an empty
    // badge cannot be mistaken for a hidden column.
    await expect(page.locator(`${TEAMS_TABLE} .tabulator-col[tabulator-field="participantRole"]`)).toBeVisible();

    const coachBadge = groupRow(page, COACH_GROUP).locator('.tmx-role-badge');
    await expect(coachBadge).toHaveCount(1);
    await expect(coachBadge).toHaveText('COACH');

    // OTHER is the neutral marker and is deliberately rendered blank rather than badged, so only
    // meaningful roles draw the eye. Assert the absence of a badge, not the absence of text — a badge
    // reading "OTHER" would be the regression.
    await expect(groupRow(page, NEUTRAL_GROUP).locator('.tmx-role-badge')).toHaveCount(0);
    expect((await groupRow(page, NEUTRAL_GROUP).locator(ROLE_CELL).innerText()).trim()).toEqual('');
  });

  test('the role is editable after creation, and the badge follows', async ({ page }) => {
    const tournamentId = await seedGroups(page);
    await gotoGroupView(page, tournamentId);

    const menu = await openRowMenu(page, NEUTRAL_GROUP);
    // The affordance itself is the assertion: without it the role is create-only, whatever the editor
    // is capable of.
    await expect(menu).toContainText('Edit group');
    await menu.locator('a', { hasText: 'Edit group' }).click();

    const drawer = page.locator(S.TMX_DRAWER);
    const roleSelect = drawer.locator('select').last();
    await expect(roleSelect).toBeVisible({ timeout: 5_000 });

    // The select must open on the group's *current* role, not a fresh default — an editor that always
    // reads OTHER would silently reset any group a TD opens and saves.
    await expect(roleSelect).toHaveValue('OTHER');
    // Every blocking role the factory policy escalates on is offered. Assert option *values*, not
    // labels: the labels are i18n'd title case ("Coach"), while the value is the factory enum the
    // mutation carries — asserting the label would pass against a select that submits the wrong thing.
    const optionValues = await roleSelect.locator('option').evaluateAll((els: any[]) => els.map((el) => el.value));
    expect(optionValues.sort((a, b) => a.localeCompare(b, 'en'))).toEqual([
      'COACH',
      'MEDICAL',
      'OTHER',
      'PHYSIO',
      'TRAINER',
    ]);

    const collector = createMutationCollector(page);
    await roleSelect.selectOption('MEDICAL');
    await drawer.getByText('Save', { exact: true }).click();

    // Assert the dispatched params, not just the redraw: the badge could update from a stale local
    // refresh while the mutation carried the wrong role.
    const entry = await collector.waitForMethod('modifyParticipant', 8_000);
    const params = entry.methods.find((m) => m.method === 'modifyParticipant')?.params as Record<string, any>;
    expect(params.participant.participantRole).toEqual('MEDICAL');
    expect(params.participant.participantName).toEqual(NEUTRAL_GROUP);
    collector.detach();

    // ...and the table reflects it, which is the whole point of the badge.
    await expect(groupRow(page, NEUTRAL_GROUP).locator('.tmx-role-badge')).toHaveText('MEDICAL', { timeout: 8_000 });

    // The other group is untouched — a role edit must not smear across rows.
    await expect(groupRow(page, COACH_GROUP).locator('.tmx-role-badge')).toHaveText('COACH');
  });
});
