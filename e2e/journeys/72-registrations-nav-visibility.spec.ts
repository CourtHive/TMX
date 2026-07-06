import { test, expect, type Page } from '@playwright/test';
import { initDevBridge } from '../helpers/dev-bridge';
import { SERVER, signInSuperAdmin, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD } from '../helpers/role-fixtures';
import { TournamentPage } from '../pages/TournamentPage';
import { AuthFlow } from '../pages/AuthFlow';

/**
 * Journey 72 — Registrations nav icon conditional visibility.
 *
 * `#rg-route` shows only when canManageRegistrations passes BOTH gates:
 * (1) the tournament has `registrationProfile.entriesOpen`, and (2) the caller
 * has provider-admin authority (a super-admin satisfies this). A regression that
 * shows the tab to someone whose actions 403, or hides it from a legitimate
 * admin, is a pure integration bug the unit test can't catch. Real CFS login
 * (super-admin); skips when CFS is absent.
 */

const RG_ROUTE = '#rg-route';

let seeded = false;

/** Seed a tournament, optionally with an open registration profile. */
async function seedTournamentWithReg(page: Page, withRegistration: boolean): Promise<string> {
  return page.evaluate(async (withReg) => {
    await dev.tmx2db.initDB();
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      setState: true,
      tournamentName: 'E2E Registrations',
      tournamentAttributes: { tournamentId: `e2e-reg-${withReg ? 'open' : 'none'}` },
      drawProfiles: [{ eventName: 'Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
    });
    const rec = dev.factory.tournamentEngine.getTournament().tournamentRecord;
    if (withReg) {
      rec.registrationProfile = { entriesOpen: new Date().toISOString() };
      dev.factory.tournamentEngine.setState(rec);
    }
    await dev.tmx2db.addTournament(rec);
    return rec.tournamentId as string;
  }, withRegistration);
}

test.describe('Journey 72 — registrations nav visibility', () => {
  test.beforeAll(async ({ request }) => {
    seeded = !!(await signInSuperAdmin(request));
  });

  test('rg-route is shown when a registration profile is open (super-admin)', async ({ page }) => {
    test.skip(!seeded, `CFS at ${SERVER} / bootstrap super-admin unavailable`);

    const auth = new AuthFlow(page);
    await auth.login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    await initDevBridge(page);
    const tournamentId = await seedTournamentWithReg(page, true);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);

    await expect(page.locator(RG_ROUTE)).toBeVisible({ timeout: 10_000 });
  });

  test('rg-route is hidden without a registration profile', async ({ page }) => {
    test.skip(!seeded, `CFS at ${SERVER} / bootstrap super-admin unavailable`);

    const auth = new AuthFlow(page);
    await auth.login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    await initDevBridge(page);
    const tournamentId = await seedTournamentWithReg(page, false);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);

    await expect(page.locator(RG_ROUTE)).toBeHidden();
  });
});
