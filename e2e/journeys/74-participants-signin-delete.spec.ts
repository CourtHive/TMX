import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { seedTournament, PROFILE_EMPTY_TOURNAMENT } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/**
 * Journey 74 — Participants: sign-in + delete round-trip (+ recycled-row crash guard).
 *
 * Participant CRUD is the most-used surface with no e2e coverage. Selecting rows
 * reveals the overlay control-bar actions:
 *   - Sign in       → modifyParticipantsSignInStatus
 *   - Delete selected → confirm modal → deleteParticipants
 * After a delete, clicking a now-recycled Tabulator row must NOT throw — the
 * documented `_selectRow` "reading 'add'" crash on wiped rows
 * (feedback_tabulator_selectrow_wiped_row). A pageerror listener nets it.
 *
 * Asserts dispatch via the mutation collector and counts via the factory
 * (robust against Tabulator's virtualized DOM).
 */

const ROWS = `${S.TOURNAMENT_PARTICIPANTS} .tabulator-row`;

async function participantCount(page: Page): Promise<number> {
  return page.evaluate(() => dev.getTournament().participants?.length ?? 0);
}

async function selectRow(page: Page, index: number): Promise<void> {
  await page.locator(`${ROWS}`).nth(index).locator('input[type="checkbox"]').first().click();
}

test.describe('Journey 74 — participants sign-in + delete', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('signing in selected participants dispatches modifyParticipantsSignInStatus', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_EMPTY_TOURNAMENT);
    const collector = createMutationCollector(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToParticipants();
    await page.waitForSelector(ROWS, { timeout: 10_000 });

    await selectRow(page, 0);
    await selectRow(page, 1);

    // Overlay action appears once rows are selected.
    const signIn = page.getByRole('button', { name: 'Sign in' });
    await expect(signIn).toBeVisible({ timeout: 5_000 });
    await signIn.click();

    await collector.waitForMethod('modifyParticipantsSignInStatus', 10_000);
    collector.detach();
  });

  test('deleting participants dispatches deleteParticipants, drops the count, and no recycled-row crash', async ({
    page,
  }) => {
    const tournamentId = await seedTournament(page, PROFILE_EMPTY_TOURNAMENT);
    const collector = createMutationCollector(page);

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToParticipants();
    await page.waitForSelector(ROWS, { timeout: 10_000 });

    const before = await participantCount(page);

    await selectRow(page, 0);
    await selectRow(page, 1);

    const deleteSelected = page.getByRole('button', { name: 'Delete selected' });
    await expect(deleteSelected).toBeVisible({ timeout: 5_000 });
    await deleteSelected.click();

    // Confirm modal — the danger confirm button carries id 'deleteDraw'.
    await page.locator('#deleteDraw').click();

    await collector.waitForMethod('deleteParticipants', 10_000);
    await expect.poll(() => participantCount(page), { timeout: 8_000 }).toBe(before - 2);

    // Recycled-row crash guard: click a surviving row after the delete re-render.
    await page.waitForSelector(ROWS, { timeout: 5_000 });
    await page.locator(ROWS).first().click();
    await page.waitForTimeout(200);
    expect(pageErrors, `page errors after clicking a post-delete row: ${pageErrors.join(' | ')}`).toEqual([]);

    collector.detach();
  });
});
