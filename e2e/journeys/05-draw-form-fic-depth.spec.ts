/**
 * Journey 5 — Draw form: FEED_IN_CHAMPIONSHIP depth constraints
 *
 * Tests that FIC depth options are disabled based on draw size.
 * Also covers the SE → FIC transition.
 *
 * @see Test matrix section 7
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { DrawFormDrawer } from '../pages/DrawFormDrawer';

/* ─── Seed profiles ─────────────────────────────────────────────────────── */

/** Small event (4 entries) to test FIC depth constraint at minimal draw size. */
const PROFILE_SMALL_EVENT: MockProfile = {
  tournamentName: 'E2E FIC Small',
  tournamentAttributes: { tournamentId: 'e2e-fic-small' },
  participantsProfile: { scaledParticipantsCount: 8 },
  eventProfiles: [
    {
      eventName: 'Singles 4',
      drawProfiles: [],
      participantsCount: 4,
    },
  ],
};

/** Medium event (12 entries → drawSize=16) to test FIC depth constraints. */
const PROFILE_MEDIUM_EVENT: MockProfile = {
  tournamentName: 'E2E FIC Medium',
  tournamentAttributes: { tournamentId: 'e2e-fic-medium' },
  participantsProfile: { scaledParticipantsCount: 16 },
  eventProfiles: [{ eventName: 'Singles 12', drawProfiles: [] }],
};

/** Large event (24 entries → drawSize=32) where all FIC depths are available. */
const PROFILE_LARGE_EVENT: MockProfile = {
  tournamentName: 'E2E FIC Large',
  tournamentAttributes: { tournamentId: 'e2e-fic-large' },
  participantsProfile: { scaledParticipantsCount: 32 },
  eventProfiles: [{ eventName: 'Singles 24', drawProfiles: [] }],
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

async function seedAndOpenFICDrawForm(page: any, profile: MockProfile): Promise<DrawFormDrawer> {
  const tournamentId = await seedTournament(page, profile);
  const tournamentPage = new TournamentPage(page);
  await tournamentPage.goto(tournamentId);
  await tournamentPage.navigateToEvents();
  await page.locator(`${tournamentPage.eventsTable.toString()} .tabulator-row`).first().click();
  await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
  await page.getByRole('button', { name: 'Add draw' }).click();

  const drawer = new DrawFormDrawer(page);
  await drawer.waitForOpen();
  await drawer.selectDrawType('FEED_IN_CHAMPIONSHIP');
  return drawer;
}

/** Check if a specific FIC depth option is disabled in the select. */
async function isFicOptionDisabled(drawer: DrawFormDrawer, value: string): Promise<boolean> {
  const option = drawer.fieldSelect('Consolation feed depth').locator(`option[value="${value}"]`);
  return (await option.getAttribute('disabled')) !== null;
}

/* ─── Tests ──────────────────────────────────────────────────────────────── */

test.describe('Journey 5 — FIC depth constraints', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('7.4 — large draw (32+): all FIC depth options enabled', async ({ page }) => {
    const drawer = await seedAndOpenFICDrawForm(page, PROFILE_LARGE_EVENT);

    await drawer.expectFieldVisible('Consolation feed depth');
    expect(await isFicOptionDisabled(drawer, 'R16')).toBe(false);
    expect(await isFicOptionDisabled(drawer, 'QF')).toBe(false);
    expect(await isFicOptionDisabled(drawer, 'SF')).toBe(false);
    expect(await isFicOptionDisabled(drawer, 'F')).toBe(false);

    await drawer.clickCancel();
  });

  test('1.1.5 — SE → FIC transition: fic depth field appears', async ({ page }) => {
    const drawer = await seedAndOpenFICDrawForm(page, PROFILE_LARGE_EVENT);

    // Already in FIC mode from the helper — verify depth is visible
    await drawer.expectFieldVisible('Consolation feed depth');

    // Switch back to SE — depth should hide
    await drawer.selectDrawType('SINGLE_ELIMINATION');
    await drawer.expectFieldHidden('Consolation feed depth');

    // Switch back to FIC — depth should reappear
    await drawer.selectDrawType('FEED_IN_CHAMPIONSHIP');
    await drawer.expectFieldVisible('Consolation feed depth');

    await drawer.clickCancel();
  });
});
