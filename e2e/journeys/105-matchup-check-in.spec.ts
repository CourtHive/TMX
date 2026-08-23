import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/**
 * Journey 105 — per-matchUp check-in at the desk.
 *
 * CA's framing, which is what this covers: `signInStatus` is FIRST ARRIVAL at the tournament;
 * separately a specific matchUp needs its own check-in, because several matchUps are scheduled at
 * 12:00 and **both individual participants of a doubles pair must present themselves at the desk**
 * before the matchUp is called to court.
 *
 * **The draw is DOUBLES on purpose.** A singles fixture exercises none of the mechanism — it has no
 * nested `individualParticipants`, so an implementation that ignored them would pass a singles suite
 * and then show an empty panel for exactly the matchUps a desk operator cares about. That is not a
 * hypothetical: deleting the nested-individual branch leaves the singles unit test green while both
 * doubles ones go red.
 *
 * TMX vitest is node-env by design, so `checkInState.test.ts` covers the pure derivation and nothing
 * that renders. This is the only layer that can assert the panel exists, that a click **dispatches
 * `toggleParticipantCheckInState`**, and that the call-to-court gate warns rather than blocks (D4d).
 */

const MATCHUPS = S.TOURNAMENT_MATCHUPS;
// The panel is a hand-built <ul> of <li> rows in its own tippy — `:not(.menu-list)` keeps it distinct
// from the three-dot action menu, which renderMenu emits as <ul class="menu-list">. Same trick as
// journey 94's official picker.
const PANEL_ROW = '.tippy-content ul:not(.menu-list) > li';

async function seedDoubles(page: Page): Promise<{ tournamentId: string; sideOneName: string }> {
  return page.evaluate(async () => {
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      drawProfiles: [{ drawSize: 4, eventType: 'DOUBLES', eventName: 'Mens Doubles' }],
      tournamentAttributes: { tournamentId: 'e2e-checkin' },
      nonRandom: 1,
      setState: true,
    });
    await dev.load(tournamentRecord);

    const engine = dev.factory.tournamentEngine;
    const { matchUps } = engine.allTournamentMatchUps();
    const matchUp = matchUps.find((m: any) => m.sides?.every((s: any) => s?.participant?.individualParticipants));
    return {
      tournamentId: tournamentRecord.tournamentId,
      // An INDIVIDUAL's name, not the PAIR's: the matchUps table renders the side from its members,
      // so the pair's own `participantName` ("Ripley/Chip") never appears as row text.
      sideOneName: matchUp?.sides?.[0]?.participant?.individualParticipants?.[0]?.participantName ?? '',
    };
  });
}

async function openCheckInPanel(page: Page, sideOneName: string) {
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
  return menu;
}

test.describe('Journey 105 — per-matchUp check-in', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('the menu offers Check in with a partial count, never a tick', async ({ page }) => {
    const { tournamentId, sideOneName } = await seedDoubles(page);
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToMatchUps();

    const menu = await openCheckInPanel(page, sideOneName);

    // "Check in", never "Sign in" (D4a) — signing in is arrival at the tournament and is
    // tournament-wide. And `0/4`, because a doubles matchUp has FOUR individuals who each present
    // themselves separately; a boolean would collapse the state the desk is managing.
    await expect(menu.locator('a', { hasText: 'Check in' })).toContainText('0/4');
    await expect(menu.locator('a', { hasText: 'Sign in' })).toHaveCount(0);
  });

  test('the panel lists all four individuals and a click dispatches the toggle', async ({ page }) => {
    const { tournamentId, sideOneName } = await seedDoubles(page);
    const collector = createMutationCollector(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToMatchUps();

    const menu = await openCheckInPanel(page, sideOneName);
    await menu.locator('a', { hasText: 'Check in' }).click();

    // Four rows — the individuals, not the two PAIRs (D4c). The factory would accept a PAIR-level
    // check-in and nothing reconciles it with the individual ones, so the UI must never offer it.
    const rows = page.locator(PANEL_ROW);
    await expect(rows).toHaveCount(4, { timeout: 5_000 });

    await rows.first().click();

    // The dispatch is the assertion that matters — a panel that paints a tick and stores nothing is
    // exactly the failure a DOM-only check would miss.
    await collector.waitForMethod('toggleParticipantCheckInState', 10_000);
    collector.detach();

    // And it persisted: the engine now reports one individual checked in on that matchUp.
    const checkedIn = await page.evaluate(() => {
      const { matchUps } = dev.factory.tournamentEngine.allTournamentMatchUps();
      return matchUps.flatMap((m: any) => m.checkedInParticipantIds ?? []).length;
    });
    expect(checkedIn).toEqual(1);

    // Partial state is now visible rather than implied.
    await expect(page.locator('.tmx-checkin-heading')).toContainText('1/4');
    await expect(page.locator('.tmx-checkin-row.is-checked-in')).toHaveCount(1);
  });

  test('checking in is reversible from the same row', async ({ page }) => {
    const { tournamentId, sideOneName } = await seedDoubles(page);
    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToMatchUps();

    const menu = await openCheckInPanel(page, sideOneName);
    await menu.locator('a', { hasText: 'Check in' }).click();

    const rows = page.locator(PANEL_ROW);
    await expect(rows).toHaveCount(4, { timeout: 5_000 });

    await rows.first().click();
    await expect(page.locator('.tmx-checkin-row.is-checked-in')).toHaveCount(1);

    // A desk operator checks somebody in by mistake constantly; the same control has to undo it.
    await rows.first().click();
    await expect(page.locator('.tmx-checkin-row.is-checked-in')).toHaveCount(0);

    const checkedIn = await page.evaluate(() => {
      const { matchUps } = dev.factory.tournamentEngine.allTournamentMatchUps();
      return matchUps.flatMap((m: any) => m.checkedInParticipantIds ?? []).length;
    });
    expect(checkedIn).toEqual(0);
  });
});
