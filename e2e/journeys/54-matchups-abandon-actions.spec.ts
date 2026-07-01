import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { seedTournament } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

// Compute the browser-local calendar date so it matches the app's
// dayjs().format('YYYY-MM-DD') exactly — seeding endDate from a UTC-derived
// string could land on the wrong calendar day west of UTC and flip the gate.
async function browserToday(page: Page): Promise<string> {
  return page.evaluate(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  });
}

const DRAW_PROFILE = {
  eventName: 'Singles',
  drawType: 'SINGLE_ELIMINATION',
  seedsCount: 4,
  drawSize: 16,
};

test.describe('Journey 54 — matchUps Actions: abandon remaining matches', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('on the last date: Actions → Abandon sets readyToScore matchUps to ABANDONED', async ({ page }) => {
    const today = await browserToday(page);
    const collector = createMutationCollector(page);
    const tournament = new TournamentPage(page);

    // Single-day tournament ending today → gate open AND still in date range
    // (no "Modify?" toast), so the mutation dispatches directly.
    const tournamentId = await seedTournament(page, {
      tournamentName: 'E2E Abandon MatchUps',
      tournamentAttributes: { tournamentId: 'e2e-abandon-001' },
      participantsProfile: { scaledParticipantsCount: 32 },
      drawProfiles: [DRAW_PROFILE],
      startDate: today,
      endDate: today,
    });
    expect(tournamentId).toBe('e2e-abandon-001');

    await tournament.goto(tournamentId);
    await tournament.navigateToMatchUps();
    await expect(page.locator(S.MATCHUPS_CONTROL)).toBeVisible();

    // Gate is open on/past the last date → the Actions menu is present.
    const actions = page.locator('#matchUpsActions');
    await expect(actions).toBeVisible();

    // Open the menu and choose the abandon action.
    await actions.click();
    await page.locator('#matchUpsActions .dropdown-item', { hasText: 'Abandon remaining matches' }).click();

    // Confirm the modal (leave the partial-scores checkbox unchecked).
    // cModal's visible surface is `.chc-modal-dialog` — the outer
    // `section.chc-modal` has zero height (its container is position:fixed).
    const dialog = page.locator('.chc-modal-dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Ok' }).click();

    // The mutation dispatches through mutationRequest...
    await collector.waitForMethod('abandonTournamentMatchUps');

    // ...and the readyToScore matchUps are now ABANDONED.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const { matchUps } = dev.factory.tournamentEngine.allTournamentMatchUps();
          return matchUps.filter((m: any) => m.matchUpStatus === 'ABANDONED').length;
        }),
      )
      .toBeGreaterThan(0);

    collector.detach();
  });

  test('before the last date: Actions menu is not shown', async ({ page }) => {
    const tournament = new TournamentPage(page);

    const tournamentId = await seedTournament(page, {
      tournamentName: 'E2E Abandon Gate',
      tournamentAttributes: { tournamentId: 'e2e-abandon-gate' },
      participantsProfile: { scaledParticipantsCount: 32 },
      drawProfiles: [DRAW_PROFILE],
      startDate: '2099-01-01',
      endDate: '2099-12-31',
    });

    await tournament.goto(tournamentId);
    await tournament.navigateToMatchUps();
    await expect(page.locator(S.MATCHUPS_CONTROL)).toBeVisible();

    // Well before the last date → gate closed, no Actions menu.
    await expect(page.locator('#matchUpsActions')).toHaveCount(0);
  });
});
