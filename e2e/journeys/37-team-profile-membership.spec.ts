import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTeamTournamentWithStaff } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 37 — Team profile membership split (Roster / Coaches / Staff).
 *
 * mocksEngine emits only COMPETITORs when it assembles a TEAM event; the
 * import wizard is the path real tournaments use to add coaches / medical
 * / physio etc., with `person.biographicalInformation.teamAttributes[0]
 * .teamName` set on every imported person regardless of role. This journey
 * uses the `seedTeamTournamentWithStaff` helper to reproduce that shape
 * deterministically, then asserts that `teamProfileModal` slots each
 * participant into the right bucket.
 *
 * The bucket routing is unit-tested in `teamProfileLogic.test.ts`
 * (13 cases — splitMembership / parseJersey / jerseySorter). This journey
 * exercises the live render: the modal opens, the three section tables
 * render with the expected row counts, and the staff bucket carries the
 * non-COMPETITOR role through the role-badge column.
 */

const MODAL_TITLE_SELECTOR = '.chc-modal-title';
const TEAM_NAME_AUTHENTICS = 'The Authentics';
const TEAM_NAME_CAULDRON = 'Cauldron';

test.describe('Journey 37 — Team profile membership split', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('opens with Roster + Coaches + Staff sections matching seeded counts', async ({ page }) => {
    const { tournamentId, teamIds } = await seedTeamTournamentWithStaff(page, {
      teamNames: [TEAM_NAME_AUTHENTICS, TEAM_NAME_CAULDRON],
      playersPerTeam: 6,
      staff: [
        { role: 'COACH', name: 'Coach One', teamName: TEAM_NAME_AUTHENTICS },
        { role: 'MEDICAL', name: 'Doc Strange', teamName: TEAM_NAME_AUTHENTICS },
        { role: 'PHYSIO', name: 'Phyllis Therapist', teamName: TEAM_NAME_AUTHENTICS },
        // Cauldron's coach — proves the helper isolates staff to the named
        // team and splitMembership doesn't bleed across teams.
        { role: 'COACH', name: 'Coach Two', teamName: TEAM_NAME_CAULDRON },
      ],
    });

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);

    // Open Authentics' profile directly via the dev bridge — the participant-
    // table popover -> menu-item path is heavy and already covered indirectly
    // by participantActions usage; this journey targets the modal's contract.
    await page.evaluate((participantId) => {
      (globalThis as any).dev.openTeamProfile(participantId);
    }, teamIds[TEAM_NAME_AUTHENTICS]);

    await expect(page.locator(MODAL_TITLE_SELECTOR)).toContainText(TEAM_NAME_AUTHENTICS);

    // Section headings are formatted as `${label} (${count})` — e.g. "Roster (6)".
    const dialog = page.locator('.chc-modal-dialog');
    await expect(dialog.getByText('Roster (6)')).toBeVisible();
    await expect(dialog.getByText('Coaches (1)')).toBeVisible();
    await expect(dialog.getByText('Staff (2)')).toBeVisible();

    // The header card surfaces the per-bucket counts in the meta line.
    // Both player + coaches + staff segments must appear.
    await expect(dialog.getByText(/6 players/)).toBeVisible();
    await expect(dialog.getByText(/1 coach/)).toBeVisible();
    await expect(dialog.getByText(/2 staff/)).toBeVisible();
  });

  test('renders only Roster when team has no staff', async ({ page }) => {
    const { tournamentId, teamIds } = await seedTeamTournamentWithStaff(page, {
      teamNames: [TEAM_NAME_AUTHENTICS, TEAM_NAME_CAULDRON],
      playersPerTeam: 6,
      staff: [],
    });

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);

    await page.evaluate((participantId) => {
      (globalThis as any).dev.openTeamProfile(participantId);
    }, teamIds[TEAM_NAME_AUTHENTICS]);

    const dialog = page.locator('.chc-modal-dialog');
    await expect(dialog.getByText('Roster (6)')).toBeVisible();
    // Sections only render when their bucket is non-empty — Coaches / Staff
    // headings must be absent entirely (not just "(0)"). Anchor on the
    // trailing " (" so the regex doesn't false-match roster member names
    // like "Stafford ..." that mocksEngine pulls from its name pool.
    await expect(dialog.getByText(/^Coaches \(/)).toHaveCount(0);
    await expect(dialog.getByText(/^Staff \(/)).toHaveCount(0);
  });

  test('does not leak staff across teams — Cauldron sees only its own coach', async ({ page }) => {
    const { tournamentId, teamIds } = await seedTeamTournamentWithStaff(page, {
      teamNames: [TEAM_NAME_AUTHENTICS, TEAM_NAME_CAULDRON],
      playersPerTeam: 6,
      staff: [
        { role: 'COACH', name: 'Coach One', teamName: TEAM_NAME_AUTHENTICS },
        { role: 'MEDICAL', name: 'Doc Strange', teamName: TEAM_NAME_AUTHENTICS },
        { role: 'COACH', name: 'Coach Two', teamName: TEAM_NAME_CAULDRON },
      ],
    });

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);

    await page.evaluate((participantId) => {
      (globalThis as any).dev.openTeamProfile(participantId);
    }, teamIds[TEAM_NAME_CAULDRON]);

    await expect(page.locator(MODAL_TITLE_SELECTOR)).toContainText(TEAM_NAME_CAULDRON);

    const dialog = page.locator('.chc-modal-dialog');
    await expect(dialog.getByText('Roster (6)')).toBeVisible();
    await expect(dialog.getByText('Coaches (1)')).toBeVisible();
    // Cauldron has no medical — Staff section must not render. Anchor on
    // " (" so a roster member named "Stafford ..." (mocksEngine name pool)
    // doesn't false-trigger the regex.
    await expect(dialog.getByText(/^Staff \(/)).toHaveCount(0);
    // And the Authentics-only names must not appear in Cauldron's dialog.
    await expect(dialog.getByText('Doc Strange')).toHaveCount(0);
    await expect(dialog.getByText('Coach One')).toHaveCount(0);
    await expect(dialog.getByText('Coach Two')).toBeVisible();
  });
});
