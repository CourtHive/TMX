import { test, expect, Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/**
 * Journey 94 — matchUp official picker: conflict-of-interest states.
 *
 * The picker annotates each candidate official before selection — none / warn / blocked — from a
 * purely local `tournamentEngine.getMatchUpOfficialConflicts` evaluation, where the declaration is
 * GROUP membership in the tournamentRecord itself. A GROUP's `participantRole` is what escalates
 * SHARED_GROUPING from WARN to BLOCK.
 *
 * This is the only layer that can test it. TMX vitest is node-env by design, so
 * `officialConflicts.test.ts` covers the pure classification helpers and nothing that renders:
 * the dot, the `data-conflict` attribute, the not-selectable row, the confirm dialog, and — the part
 * that actually matters — whether a click dispatches `addMatchUpOfficial` at all.
 *
 * Assertions run against the *dispatched mutation params*, not just the DOM. A picker that paints
 * the right badge and still dispatches a blocked assignment is the failure worth catching, and it is
 * invisible to anything that only reads the rendered row.
 *
 * Note the deliberate asymmetry in what the three states enforce: BLOCK refuses in the UI *and* at
 * the factory gate (the mutation carries `policyDefinitions`, so the engine re-runs the same check);
 * WARN only asks. The UI is an affordance — the gate is the check.
 */

const MATCHUPS = S.TOURNAMENT_MATCHUPS;
// The picker is a hand-built `<ul>` of `<li>` rows in its own tippy. `:not(.menu-list)` keeps it
// distinct from the three-dot action menu, which renderMenu emits as `<ul class="menu-list">` —
// same container, same tag, different thing.
const PICKER_ROW = '.tippy-content ul:not(.menu-list) > li';

const CLEAN_OFFICIAL = 'Chair Unaffiliated';
const WARN_OFFICIAL = 'Chair Grouped';
const BLOCK_OFFICIAL = 'Chair Coach';

interface Seeded {
  tournamentId: string;
  matchUpId: string;
  /** Name of the competitor on side 1 — how the journey finds the matchUp's row in the table. */
  sideOneName: string;
}

/**
 * Seed a draw plus three officials whose only difference is the GROUP they share with a competitor
 * in the target matchUp:
 *
 *   - CLEAN  — in no group at all                       → none
 *   - WARN   — in an OTHER group with side 1            → WARN (shared grouping, neutral role)
 *   - BLOCK  — in a COACH group with side 2             → BLOCK (role escalation)
 *
 * Each conflicted official is grouped with a *different* side so a bug that attributes a conflict to
 * the wrong participant cannot accidentally produce the expected badge on both rows.
 *
 * Persisted with a single `addTournament` after all mutations so the write does not race the
 * fire-and-forget persist inside `dev.load` (same gotcha as journeys 29 and 57).
 */
async function seedOfficialsWithGroupings(page: Page): Promise<Seeded> {
  return page.evaluate(
    async ({ cleanName, warnName, blockName }) => {
      await dev.tmx2db.initDB();

      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        tournamentName: 'E2E Official Conflicts',
        tournamentAttributes: { tournamentId: 'e2e-official-conflicts' },
        participantsProfile: { scaledParticipantsCount: 16 },
        drawProfiles: [{ eventName: 'Conflict Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
      });
      const tournamentId = tournamentRecord.tournamentId as string;

      const addOfficial = (participantName: string) => {
        const { participant }: any = dev.factory.tournamentEngine.addParticipant({
          returnParticipant: true,
          tournamentId,
          participant: {
            participantRole: dev.factory.participantRoles.OFFICIAL,
            participantType: 'INDIVIDUAL',
            participantName,
            person: {
              standardGivenName: participantName.split(' ')[0],
              standardFamilyName: participantName.split(' ').slice(1).join(' '),
            },
          },
        });
        return participant.participantId as string;
      };

      // The clean official's id is deliberately discarded — being in no group at all is the point.
      addOfficial(cleanName);
      const warnId = addOfficial(warnName);
      const blockId = addOfficial(blockName);

      const { matchUps } = dev.factory.tournamentEngine.allTournamentMatchUps();
      const matchUp = matchUps.find((m: any) => m.sides?.every((s: any) => s?.participantId));
      if (!matchUp) throw new Error('No fully-populated matchUp in the seeded draw');

      const group = (individualParticipantIds: string[], groupName: string, participantRole: string) => {
        const created: any = dev.factory.tournamentEngine.createGroupParticipant({
          individualParticipantIds,
          participantRole,
          groupName,
          tournamentId,
        });
        if (!created?.success) throw new Error(`createGroupParticipant failed for ${groupName}`);
      };

      // OTHER is the neutral marker — a shared grouping with no declared relationship. WARN.
      group([warnId, matchUp.sides[0].participantId], 'Training Squad', dev.factory.participantRoles.OTHER);
      // COACH is an authored relationship. BLOCK.
      group([blockId, matchUp.sides[1].participantId], 'Coaching Group', dev.factory.participantRoles.COACH);

      const mutated = dev.factory.tournamentEngine.getTournament().tournamentRecord;
      await dev.tmx2db.addTournament(mutated);

      const sideOneName = matchUp.sides[0].participant?.participantName;
      if (!sideOneName) throw new Error('Seeded matchUp side 1 has no participantName to locate its row by');

      return { tournamentId, matchUpId: matchUp.matchUpId as string, sideOneName: sideOneName as string };
    },
    { cleanName: CLEAN_OFFICIAL, warnName: WARN_OFFICIAL, blockName: BLOCK_OFFICIAL },
  );
}

/**
 * Open the target matchUp's three-dot menu and choose "Select official".
 *
 * The three-dot tippy is created on demand inside Tabulator's cellClick and shown in the same click,
 * so the first click is consumed. Poll rather than assume a click count (journey 91's approach).
 */
async function openOfficialPicker(page: Page, sideOneName: string) {
  const targetRow = page.locator(`${MATCHUPS} .tabulator-row`).filter({ hasText: sideOneName }).first();
  await expect(targetRow).toBeVisible({ timeout: 10_000 });

  const threeDots = targetRow.locator('.fa-ellipsis-vertical');
  const menu = page.locator('.tippy-content .menu-list');
  for (let attempt = 0; attempt < 4; attempt++) {
    if (await menu.isVisible().catch(() => false)) break;
    await threeDots.click({ force: true });
    await page.waitForTimeout(250);
  }
  await expect(menu).toBeVisible({ timeout: 5_000 });

  await menu.locator('a', { hasText: 'Select official' }).click();
  await expect(page.locator(PICKER_ROW).first()).toBeVisible({ timeout: 5_000 });
}

const pickerRow = (page: Page, name: string) => page.locator(PICKER_ROW).filter({ hasText: name });

test.describe('Journey 94 — official picker conflict states', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('annotates none / warn / blocked, and only dispatches what it should', async ({ page }) => {
    const seed = await seedOfficialsWithGroupings(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(seed.tournamentId);
    await tournament.navigateToMatchUps();
    await page.waitForSelector(`${MATCHUPS} .tabulator-row`, { state: 'visible', timeout: 10_000 });

    await openOfficialPicker(page, seed.sideOneName);

    // --- annotation -------------------------------------------------------------------------

    const clean = pickerRow(page, CLEAN_OFFICIAL);
    const warn = pickerRow(page, WARN_OFFICIAL);
    const blocked = pickerRow(page, BLOCK_OFFICIAL);

    // All three candidates are offered — the picker annotates rather than filters, so a TD can see
    // *why* an official is unavailable instead of wondering where they went.
    await expect(clean).toHaveCount(1);
    await expect(warn).toHaveCount(1);
    await expect(blocked).toHaveCount(1);

    // Clean: no conflict marker at all. `data-conflict` is only set when there is something to say,
    // so its absence is the assertion — and it also guards the seed: if the evaluation silently
    // errored, every row would look like this one and the two below would fail.
    await expect(clean).not.toHaveAttribute('data-conflict', /.*/);
    await expect(clean).not.toHaveAttribute('aria-disabled', /.*/);

    await expect(warn).toHaveAttribute('data-conflict', 'warn');
    await expect(warn).not.toHaveAttribute('aria-disabled', /.*/);
    // Reasons come from the factory already human-readable; the row lists them in its title.
    expect((await warn.getAttribute('title')) ?? '').not.toEqual('');

    await expect(blocked).toHaveAttribute('data-conflict', 'blocked');
    await expect(blocked).toHaveAttribute('aria-disabled', 'true');
    expect((await blocked.getAttribute('title')) ?? '').toContain('COACH');

    // --- blocked: not selectable ------------------------------------------------------------

    const collector = createMutationCollector(page);

    // No dialog should appear for a blocked row — it is refused outright, not confirmed. Fail loudly
    // if one does rather than letting Playwright's auto-dismiss hide a downgrade to WARN.
    let unexpectedDialog = '';
    const failOnDialog = (dialog: any) => {
      unexpectedDialog = dialog.message();
      return dialog.dismiss();
    };
    page.on('dialog', failOnDialog);

    await blocked.click({ force: true });
    await page.waitForTimeout(500);

    expect(unexpectedDialog).toEqual('');
    expect(collector.getMethodNames()).not.toContain('addMatchUpOfficial');
    // The picker stays open — a refused click is not a dismissal.
    await expect(blocked).toBeVisible();
    page.off('dialog', failOnDialog);

    // --- warn: confirm required, and declining dispatches nothing ---------------------------

    const dismiss = (dialog: any) => dialog.dismiss();
    page.on('dialog', dismiss);
    await warn.click({ force: true });
    await page.waitForTimeout(500);
    expect(collector.getMethodNames()).not.toContain('addMatchUpOfficial');
    page.off('dialog', dismiss);

    // --- warn: accepting the confirm dispatches, carrying the policy ------------------------

    const accept = (dialog: any) => dialog.accept();
    page.on('dialog', accept);
    await warn.click({ force: true });

    const entry = await collector.waitForMethod('addMatchUpOfficial', 8_000);
    page.off('dialog', accept);

    const dispatched = entry.methods.find((m) => m.method === 'addMatchUpOfficial');
    const params = dispatched?.params as Record<string, any>;
    expect(params.matchUpId).toEqual(seed.matchUpId);
    // The UI is an affordance; the factory gate is the enforcement point. That only holds if the
    // mutation actually carries the policy — assert the param, not the intent.
    expect(params.policyDefinitions).toBeTruthy();

    collector.detach();
  });

  test('a clean official dispatches with no confirm at all', async ({ page }) => {
    const seed = await seedOfficialsWithGroupings(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(seed.tournamentId);
    await tournament.navigateToMatchUps();
    await page.waitForSelector(`${MATCHUPS} .tabulator-row`, { state: 'visible', timeout: 10_000 });

    await openOfficialPicker(page, seed.sideOneName);

    const collector = createMutationCollector(page);
    let sawDialog = false;
    const failOnDialog = (dialog: any) => {
      sawDialog = true;
      return dialog.dismiss();
    };
    page.on('dialog', failOnDialog);

    await pickerRow(page, CLEAN_OFFICIAL).click({ force: true });

    const entry = await collector.waitForMethod('addMatchUpOfficial', 8_000);
    page.off('dialog', failOnDialog);

    // An unconflicted assignment must not interrogate the TD — over-prompting is what gets a
    // conflict check switched off.
    expect(sawDialog).toBe(false);

    const params = entry.methods.find((m) => m.method === 'addMatchUpOfficial')?.params as Record<string, any>;
    expect(params.matchUpId).toEqual(seed.matchUpId);
    expect(params.policyDefinitions).toBeTruthy();

    collector.detach();
  });
});
