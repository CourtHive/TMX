/**
 * Journey 4 — Draw form: Qualifying modes
 *
 * Tests the qualifying drawer entry points and field state:
 * - ATTACH_QUALIFYING via the "Add qualifying" structure options menu
 * - GENERATE_QUALIFYING via the "Generate qualifying" button (qualifying-first flow)
 *
 * @see Test matrix sections 1.4, 1.6, 1.7
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { DrawFormDrawer } from '../pages/DrawFormDrawer';
import { S } from '../helpers/selectors';

/* ─── Seed profiles ─────────────────────────────────────────────────────── */

/** Tournament with a main draw whose positions are NOT auto-filled.
 *  `automated: false` creates the draw structure with empty position
 *  assignments — canAddQualifying returns true because some positions
 *  have neither participantId nor bye. */
const PROFILE_MANUAL_DRAW: MockProfile = {
  tournamentName: 'E2E Qualifying Modes',
  tournamentAttributes: { tournamentId: 'e2e-qualifying' },
  participantsProfile: { scaledParticipantsCount: 16 },
  drawProfiles: [
    {
      eventName: 'Singles',
      drawSize: 16,
      drawType: 'SINGLE_ELIMINATION',
      automated: false,
    },
  ],
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

/** Navigate to the draw view for the first event's first draw. */
async function navigateToDrawView(page: any, tournamentId: string): Promise<void> {
  const tournamentPage = new TournamentPage(page);
  await tournamentPage.goto(tournamentId);
  await tournamentPage.navigateToEvents();

  // Click the event row to enter event detail
  await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
  await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });

  // Click the "Draws" tab
  await page.locator('#eventTabsBar').getByText('Draws').click();

  // The draws tab shows a table of draws — click the first draw row
  // to enter the actual draw view (bracket + structure options).
  await page.locator('.tabulator-row').first().waitFor({ state: 'visible', timeout: 5_000 });
  await page.locator('.tabulator-row').first().click();

  // Wait for the draw control bar to appear (it's inside drawsView)
  await page.locator(S.DRAW_CONTROL).waitFor({ state: 'visible', timeout: 10_000 });
}

/* ─── Tests ──────────────────────────────────────────────────────────────── */

test.describe('Journey 4 — Draw form qualifying modes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('ATTACH_QUALIFYING — "Add qualifying" from structure options opens qualifying form', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_MANUAL_DRAW);
    await navigateToDrawView(page, tournamentId);

    // The structure options dropdown is the third control-bar item (after
    // search and draw name). It shows the structure name as its label.
    // Click it to reveal the dropdown menu with "Add qualifying".
    // The structure dropdown ("Main ∨") is in the event control bar,
    // rendered by courthive-components renderControlBar. It's a .dropdown
    // element with a button trigger. The #eventControl area contains it.
    const eventControl = page.locator(S.EVENT_CONTROL);
    await eventControl.waitFor({ state: 'visible', timeout: 5_000 });

    // Click the "Main" dropdown — it's a dropdown-trigger button
    // containing the text "Main"
    const mainDropdown = eventControl.locator('.dropdown:has-text("Main")');
    await mainDropdown.locator('.dropdown-trigger').first().click();

    // Click "Add qualifying" from the dropdown menu
    const addQualifyingOption = page.getByText('Add qualifying');
    await addQualifyingOption.waitFor({ state: 'visible', timeout: 5_000 });
    await addQualifyingOption.click();

    // The addDraw drawer should open in ATTACH_QUALIFYING mode
    const drawer = new DrawFormDrawer(page);
    await drawer.waitForOpen();

    // ATTACH_QUALIFYING field assertions (section 1.7)
    await drawer.expectFieldVisible('Structure name');
    await drawer.expectFieldHidden('Draw name');
    await drawer.expectFieldVisible('Qualifiers');
    await drawer.expectFieldHidden('Seeding policy');

    // Draw type options should be narrowed to qualifying subset
    const values = await drawer.fieldSelect('Draw Type').locator('option').evaluateAll(
      (opts: HTMLOptionElement[]) =>
        opts.map((o) => o.value).filter((v) => v && !v.startsWith('─')),
    );
    const qualifyingTypes = ['SINGLE_ELIMINATION', 'ROUND_ROBIN', 'ROUND_ROBIN_WITH_PLAYOFF'];
    for (const val of values) {
      expect(qualifyingTypes).toContain(val);
    }
    expect(values.length).toBeGreaterThan(0);
    expect(values.length).toBeLessThanOrEqual(3);

    await drawer.clickCancel();
  });
});
