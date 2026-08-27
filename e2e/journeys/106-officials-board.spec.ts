import { test, expect, type Page } from '@playwright/test';
import { enablePreference, initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/**
 * Journey 106 — the officials board (P0).
 *
 * TMX vitest is node-env, so `officialsBoard.test.ts` covers the derivation and nothing that renders.
 * This is the only layer that can prove the tab is actually reachable — it is wired across seven
 * files (constants, nav icon, routeMap, tips, i18n keys, capability, tab shell, dispatch) and every
 * one of those gates is green whether or not the tab mounts.
 *
 * **The state assertion is the point, not the row count.** `waiting` vs `available` is the D5
 * decision: an official signed in TODAY is waiting; one who is not signed in reads available, meaning
 * "not known to be here". Seeding both is what makes the assertion non-vacuous — a board that
 * hard-coded either value would pass a one-official test.
 */

async function seedOfficials(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      drawProfiles: [{ drawSize: 4, eventName: 'Singles' }],
      tournamentAttributes: { tournamentId: 'e2e-officials' },
      nonRandom: 1,
      setState: true,
    });
    await dev.load(tournamentRecord);

    const engine = dev.factory.tournamentEngine;
    engine.addParticipants({
      participants: [
        {
          participantId: 'official-signed-in',
          participantName: 'Ada Signed',
          participantType: 'INDIVIDUAL',
          participantRole: 'OFFICIAL',
          person: {
            standardFamilyName: 'Signed',
            standardGivenName: 'Ada',
            // isPublic false on purpose: D6 is mark-don't-hide, so this must still RENDER.
            contacts: [{ contactType: 'MOBILE', mobileTelephone: '+15550100', isPublic: false }],
          },
        },
        {
          participantId: 'official-worked',
          participantName: 'Cy Worked',
          participantType: 'INDIVIDUAL',
          participantRole: 'OFFICIAL',
          person: { standardFamilyName: 'Worked', standardGivenName: 'Cy' },
        },
        {
          participantId: 'official-absent',
          participantName: 'Bo Absent',
          participantType: 'INDIVIDUAL',
          participantRole: 'OFFICIAL',
          person: { standardFamilyName: 'Absent', standardGivenName: 'Bo' },
        },
      ],
    });
    // Only ONE of them signs in — the control that makes waiting/available distinguishable.
    engine.modifyParticipantsSignInStatus({
      participantIds: ['official-signed-in', 'official-worked'],
      signInState: 'SIGNED_IN',
    });

    // Assign Ada a completed matchUp with measured play, scheduled TODAY, so the board has a
    // non-empty "time on court" to render. This is the case a unit test cannot prove: the column read
    // a field the factory never populates, so it was plausible in isolation and blank on screen.
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const localToday = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const { matchUps } = engine.allTournamentMatchUps();
    const target = matchUps[0];
    if (target) {
      const ids = { drawId: target.drawId, matchUpId: target.matchUpId };
      engine.addMatchUpScheduledDate({ ...ids, scheduledDate: localToday });
      engine.addMatchUpStartTime({ ...ids, startTime: '10:00' });
      engine.addMatchUpEndTime({ ...ids, endTime: '11:30' });
      // Cy, not Ada: assigning Ada a matchUp would make her `assigned` and destroy the
      // waiting-vs-available distinction the first test exists to prove.
      engine.addMatchUpOfficial({ ...ids, participantId: 'official-worked' });
    }

    await dev.save?.();
    return tournamentRecord.tournamentId;
  });
}

test.describe('Journey 106 — officials board', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
    // The board is off by default — it is a court-side surface most providers
    // never staff for, so it is opt-in from Settings > Options. Journey 116
    // covers the toggle itself; here it is a precondition.
    await enablePreference(page, 'officialsBoard');
  });

  test('the tab mounts and separates signed-in from not-known-to-be-here', async ({ page }) => {
    const tournamentId = await seedOfficials(page);
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);

    await page.locator(S.NAV_OFFICIALS).click();

    const board = page.locator(S.TOURNAMENT_OFFICIALS);
    await expect(board).toBeVisible({ timeout: 10_000 });

    const signedInRow = board.locator('.tabulator-row').filter({ hasText: 'Ada Signed' }).first();
    const absentRow = board.locator('.tabulator-row').filter({ hasText: 'Bo Absent' }).first();
    await expect(signedInRow).toBeVisible({ timeout: 10_000 });
    await expect(absentRow).toBeVisible();

    // D5: signed in today and unassigned = waiting; not signed in = available.
    await expect(signedInRow.locator('[data-official-state]')).toHaveAttribute('data-official-state', 'waiting');
    await expect(absentRow.locator('[data-official-state]')).toHaveAttribute('data-official-state', 'available');
  });

  test('time on court renders a measured duration, not a blank', async ({ page }) => {
    // The shipped defect: the column read a top-level `matchUpDuration` that no TMX hydration sets,
    // so it was always empty. 90 minutes of play must render as 1:30.
    const tournamentId = await seedOfficials(page);
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await page.locator(S.NAV_OFFICIALS).click();

    const board = page.locator(S.TOURNAMENT_OFFICIALS);
    const cyRow = board.locator('.tabulator-row').filter({ hasText: 'Cy Worked' }).first();
    await expect(cyRow).toBeVisible({ timeout: 10_000 });
    await expect(cyRow).toContainText('1:30');

    // Control: an official with no matchUp shows no duration, so the assertion above is about the
    // measured value rather than a string that appears on every row.
    const adaRow = board.locator('.tabulator-row').filter({ hasText: 'Ada Signed' }).first();
    await expect(adaRow).not.toContainText('1:30');
  });

  test('an un-consented mobile still renders on the board (D6 — mark, do not hide)', async ({ page }) => {
    const tournamentId = await seedOfficials(page);
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await page.locator(S.NAV_OFFICIALS).click();

    const board = page.locator(S.TOURNAMENT_OFFICIALS);
    const signedInRow = board.locator('.tabulator-row').filter({ hasText: 'Ada Signed' }).first();
    await expect(signedInRow).toBeVisible({ timeout: 10_000 });

    // The tappable affordance, not merely the digits — a number a director cannot press is not a
    // call sheet. Ada's contact is isPublic:false, so this also pins D6.
    await expect(signedInRow.locator('a[href^="tel:"]').first()).toBeVisible();

    // Bo has no contact at all: absence must read as absence, never as a dead link.
    const absentRow = board.locator('.tabulator-row').filter({ hasText: 'Bo Absent' }).first();
    await expect(absentRow.locator('a[href^="tel:"]')).toHaveCount(0);
  });
});
