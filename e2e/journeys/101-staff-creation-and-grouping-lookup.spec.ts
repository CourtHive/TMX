import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { seedTournament, PROFILE_EMPTY_TOURNAMENT } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/**
 * Journey 101 — Staff creation, and the grouping lookups that feed "Add to team/group".
 *
 * Both defects here were **silent**: the UI accepted the action, reported success, and produced nothing
 * the operator could see. Neither was visible to the unit tests that already covered the surface, which
 * is why this journey exists alongside them.
 *
 *   1. `editIndividualParticipant` hardcoded `view === OFFICIAL ? OFFICIAL : COMPETITOR` at creation, so
 *      a participant created from the Staff view became a COMPETITOR — which the Staff filter then
 *      excluded. The row was created, vanished from the view that created it, and joined the
 *      draw-eligible pool. A TD who assumed the save failed and retyped the name got two phantoms.
 *
 *   2. `createParticipantsTable` derived its TEAM/GROUP lists from its own *role*-filtered query.
 *      `filterParticipants` applies `participantRoles` to groupings too, and a GROUP carries OTHER, so
 *      the competitor view saw zero GROUPs and "Add to group" opened an empty menu.
 *
 * The assertion style follows the lesson journeys 91/95 encode: assert the real call path and the
 * rendered result, not the component in isolation — and assert what was *checked*, not only what was
 * found. An empty menu and a hidden menu look identical unless you prove the control is on screen.
 */

const ROWS = `${S.TOURNAMENT_PARTICIPANTS} .tabulator-row`;
const GROUP_NAME = 'Coach Ramirez stable';

async function gotoParticipants(page: Page, tournamentId: string, view?: string) {
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  if (view) {
    await page.goto(`/#/tournament/${tournamentId}/participants/${view}`);
  } else {
    await tournament.navigateToParticipants();
  }
}

/**
 * Open the control bar's Actions menu and click a labelled item.
 *
 * The menu renders its items INLINE in the control bar, not into a `.tippy-content` popper — unlike the
 * row three-dot menus that journeys 91/95 drive. Scoping to tippy finds nothing.
 */
async function clickAction(page: Page, label: string | RegExp) {
  await page.getByRole('button', { name: /Actions/i }).first().click({ force: true });
  const item = page.getByText(label).first();
  await expect(item).toBeVisible({ timeout: 5_000 });
  await item.click({ force: true });
}

test.describe('Journey 101 — staff creation + grouping lookups', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('a participant created from the Staff view is staff, and stays visible there', async ({ page }) => {
    const collector = createMutationCollector(page);
    const tournamentId = await seedTournament(page, PROFILE_EMPTY_TOURNAMENT);
    await gotoParticipants(page, tournamentId, 'STAFF');

    await clickAction(page, /New participant/i);

    const drawer = page.locator(S.TMX_DRAWER);
    await expect(drawer.getByPlaceholder('Given name')).toBeVisible({ timeout: 5_000 });

    // The role select is Staff-only. Prove it is present BEFORE using it — its absence was the bug, and
    // a default-to-COMPETITOR save would otherwise look like a passing test.
    //
    // Identified by the options it carries, not by position: the drawer holds two selects (role, then
    // sex), so an index-based locator silently picks the sex field and fails with "did not find some
    // options" — which reads as a missing role rather than a wrong element.
    const roleSelect = drawer.locator('select').filter({ has: page.locator('option[value="STRINGER"]') });
    await expect(roleSelect).toHaveCount(1);
    await expect(roleSelect).toBeVisible();

    await drawer.getByPlaceholder('Given name').fill('Marta');
    await drawer.getByPlaceholder('Family name').fill('Stringer');
    await roleSelect.selectOption('STRINGER');
    // Not `force` — the drawer's Save sits below the fold, and forcing the click uses coordinates that
    // are outside the viewport. A normal click scrolls it into view and waits for actionability.
    await page.getByRole('button', { name: 'Save' }).click();

    // The dispatched mutation is where the bug lived, so assert it directly rather than inferring it
    // from the rendered row.
    const entry = await collector.waitForMethod('addParticipants', 10_000);
    const call = entry.methods.find((m) => m.method === 'addParticipants');
    const created = (call?.params as any)?.participants?.[0];
    expect(created?.participantRole).toEqual('STRINGER');
    // The specific value that made the row disappear.
    expect(created?.participantRole).not.toEqual('COMPETITOR');

    // …and that it is visible in the view that created it. This is the half that was broken: the record
    // was written correctly-ish and then filtered out of its own view.
    await expect(page.locator(ROWS).filter({ hasText: 'Stringer' }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('"Add to group" lists existing groups from the competitor view', async ({ page }) => {
    const tournamentId = await page.evaluate(async ({ groupName }) => {
      await dev.tmx2db.initDB();
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        tournamentName: 'E2E Grouping Lookup',
        tournamentAttributes: { tournamentId: 'e2e-grouping-lookup' },
        participantsProfile: { scaledParticipantsCount: 8 },
      });
      const { participants } = dev.factory.tournamentEngine.getParticipants({
        participantFilters: { participantTypes: ['INDIVIDUAL'] },
      });
      // Role OTHER — the default, and precisely the value a [COMPETITOR] filter dropped.
      const created: any = dev.factory.tournamentEngine.createGroupParticipant({
        individualParticipantIds: participants.slice(0, 2).map((p: any) => p.participantId),
        participantRole: dev.factory.participantRoles.OTHER,
        groupName,
      });
      if (!created?.success) throw new Error('createGroupParticipant failed');
      await dev.tmx2db.addTournament(dev.factory.tournamentEngine.getTournament().tournamentRecord);
      return tournamentRecord.tournamentId as string;
    }, { groupName: GROUP_NAME });

    await gotoParticipants(page, tournamentId);
    await expect(page.locator(ROWS).first()).toBeVisible({ timeout: 10_000 });

    // Selecting a row switches the control bar into its selection (OVERLAY) layout, which is where
    // "Add to group" lives.
    await page.locator(`${ROWS} .tabulator-cell`).first().click({ force: true });

    const addToGroup = page.getByRole('button', { name: /Add to group/i }).first();
    await expect(addToGroup).toBeVisible({ timeout: 10_000 });
    await addToGroup.click({ force: true });

    // The regression: this list was empty because groupings were sieved out of a role-filtered query.
    // Assert the seeded group is OFFERED — not merely that a menu opened, which it always did. The
    // options render inline in the control bar, not into a `.tippy-content` popper.
    await expect(page.getByText(GROUP_NAME).first()).toBeVisible({ timeout: 5_000 });

    // Control: "Create new group" was present even when the list was empty, so asserting only that the
    // menu has content would have passed against the bug.
    await expect(page.getByText('Create new group').first()).toBeVisible();
  });

  /**
   * NOT covered here: "Sign out unapproved leaves personnel signed in".
   *
   * The fix is real (`signOutUnapproved` gained `participantRoles: [COMPETITOR]`; without it the action
   * signed out the entire officiating crew, since an official is signed-in-with-no-events by definition).
   * But its Actions-menu entry is `hide: !hasParticipants`, and `hasParticipants` reads
   * `table.getDataCount()` immediately after the Tabulator constructor — which has not populated yet on
   * first paint. So the item is reliably ABSENT on the first render of a view and appears only after a
   * re-render. Confirmed from the failing run's page snapshot: Sign out, Edit ratings and Edit WTID were
   * all missing while the table showed "Officials (1)".
   *
   * That first-paint race is pre-existing and app-wide, not something this branch introduced. Encoding a
   * navigate-away-and-back workaround here would produce a journey that passes for reasons unrelated to
   * the behaviour under test — the failure mode this suite exists to avoid. Recorded as a finding in
   * `Mentat/planning/TMX_PARTICIPANTS_PERSONNEL_AND_GROUPS.md` instead; the role filter itself is a
   * one-line query change covered by reading the record.
   */
});
