/**
 * Journey 84 — Manual seeding for CONFIRMED entries + seeding controls stay visible
 *
 * Regression coverage for PR #1209:
 *
 *  1. Entries with a factory-selected status the old hand-rolled list omitted
 *     (CONFIRMED / LUCKY_LOSER / QUALIFIER) used to fall through to segment
 *     rank 5 — rendering the red "?" badge and disabling the seed editor via
 *     the `_segmentRank <= 1` gate. They must now rank as "Accepted" and be
 *     seedable.
 *
 *  2. With `selectableRows: true`, clicking a seed cell also selected the row,
 *     which swapped the controlBar to selection-overlay actions and hid the
 *     Save/Cancel seeding buttons. Selection is now suspended while manual
 *     seeding is active, so those buttons stay visible while entering values.
 *
 * @see segmentSorter.ts, createUnifiedEntriesPanel.ts (selectableRowsCheck),
 *      enableManualSeeding.ts
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/* ─── Seed profile ──────────────────────────────────────────────────────── */

// 16 scaled participants entered into a singles event (generate: false leaves
// them as MAIN accepted entries) — flipped to CONFIRMED after seeding below.
const PROFILE_CONFIRMED: MockProfile = {
  tournamentName: 'E2E Confirmed Seeding',
  tournamentAttributes: { tournamentId: 'e2e-confirmed-seeding' },
  participantsProfile: { scaledParticipantsCount: 16 },
  drawProfiles: [{ eventName: 'Singles', drawSize: 16, generate: false }],
};

/* ─── Helpers ───────────────────────────────────────────────────────────── */

/** Seed the tournament, flip every accepted MAIN entry to CONFIRMED, open Entries. */
async function navigateToConfirmedEntries(page: any): Promise<string> {
  const tournamentId = await seedTournament(page, PROFILE_CONFIRMED);

  // Flip the mock's DIRECT_ACCEPTANCE entries to CONFIRMED — the status the
  // old accepted-list omitted. This is the exact shape produced by external
  // signup/import flows that surfaced the bug.
  await page.evaluate(() => {
    const tournament = dev.getTournament();
    const event = tournament.events?.[0];
    if (!event) return;
    for (const entry of event.entries || []) {
      if (entry.entryStatus === 'DIRECT_ACCEPTANCE') entry.entryStatus = 'CONFIRMED';
    }
    dev.factory.tournamentEngine.setState(tournament);
  });

  const tournamentPage = new TournamentPage(page);
  await tournamentPage.goto(tournamentId);
  await tournamentPage.navigateToEvents();
  await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
  await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });

  const entriesVisible = await page
    .locator(S.ENTRIES_VIEW)
    .isVisible()
    .catch(() => false);
  if (!entriesVisible) {
    await page.locator('#eventTabsBar').getByText('Entries').click();
  }
  await page.waitForSelector(S.ENTRIES_VIEW, { state: 'visible', timeout: 10_000 });
  // Wait for the Grouping badges to render.
  await page.locator(`${S.ENTRIES_VIEW} .tabulator-cell[tabulator-field="segment"] .tag`).first().waitFor({
    state: 'visible',
    timeout: 5_000,
  });
  return tournamentId;
}

const segmentBadges = (page: any) => page.locator(`${S.ENTRIES_VIEW} .tabulator-cell[tabulator-field="segment"] .tag`);

async function enableManualSeeding(page: any): Promise<void> {
  await page.getByText('Seeding', { exact: true }).click();
  const manualOption = page.getByText('Manual seeding', { exact: true }).first();
  await manualOption.waitFor({ state: 'visible', timeout: 3_000 });
  await manualOption.click();
  // seedNumber column is shown (table.showColumn) once seeding is active.
  await page
    .locator(`${S.ENTRIES_VIEW} .tabulator-cell[tabulator-field="seedNumber"]`)
    .first()
    .waitFor({ state: 'attached', timeout: 3_000 });
}

// Only rows whose `editable` gate passes get Tabulator's `tabulator-editable`
// class — i.e. accepted/qualifying seed cells under active manual seeding.
// Pre-fix, CONFIRMED rows ranked 5 and never matched this.
const editableSeedCells = (page: any) =>
  page.locator(`${S.ENTRIES_VIEW} .tabulator-cell.tabulator-editable[tabulator-field="seedNumber"]`);

/* ─── Tests ─────────────────────────────────────────────────────────────── */

test.describe('Journey 84 — Manual seeding for CONFIRMED entries', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('CONFIRMED entries render the "Accepted" badge, never the "?" fallback', async ({ page }) => {
    await navigateToConfirmedEntries(page);

    const labels = (await segmentBadges(page).allTextContents()).map((label: string) => label.trim());
    console.log('84: segment badges:', JSON.stringify(labels));

    // Regression: CONFIRMED used to rank 5 → "?". It must rank 0 → "Accepted".
    expect(labels).toContain('Accepted');
    expect(labels).not.toContain('?');
  });

  test('CONFIRMED seed cell opens an editor under manual seeding', async ({ page }) => {
    await navigateToConfirmedEntries(page);
    await enableManualSeeding(page);

    // Pre-fix regression: with CONFIRMED at rank 5 the editable gate rejected
    // every seed cell, so none carried `tabulator-editable`.
    await expect(editableSeedCells(page).first()).toBeVisible({ timeout: 3_000 });
    expect(await editableSeedCells(page).count()).toBeGreaterThan(0);

    await editableSeedCells(page).first().click();
    // The numericEditor input (not a row-selection checkbox) mounts into the cell.
    const editor = page.locator(`${S.ENTRIES_VIEW} input:not([type="checkbox"])`);
    await expect(editor).toBeVisible({ timeout: 3_000 });
  });

  test('Save/Cancel seeding stay visible and no row is selected while entering a value', async ({ page }) => {
    await navigateToConfirmedEntries(page);
    await enableManualSeeding(page);

    const saveBtn = page.getByText('Save seeding');
    const cancelBtn = page.getByText('Cancel', { exact: true });
    await expect(saveBtn).toBeVisible({ timeout: 3_000 });
    await expect(cancelBtn).toBeVisible();

    // Type a seed value into the first CONFIRMED row's seed cell.
    await expect(editableSeedCells(page).first()).toBeVisible({ timeout: 3_000 });
    await editableSeedCells(page).first().click();
    const editor = page.locator(`${S.ENTRIES_VIEW} input:not([type="checkbox"])`);
    await expect(editor).toBeVisible({ timeout: 3_000 });
    await editor.fill('1');
    await editor.press('Enter');

    // Pre-fix: the cell click also selected the row, swapping the controlBar to
    // selection-overlay actions and hiding these buttons. Both must still show.
    await expect(saveBtn).toBeVisible();
    await expect(cancelBtn).toBeVisible();

    // And selection must have been suspended entirely (selectableRowsCheck).
    const selectedCount = await page.locator(`${S.ENTRIES_VIEW} .tabulator-row.tabulator-selected`).count();
    expect(selectedCount).toBe(0);
  });
});
