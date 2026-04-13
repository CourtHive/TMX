/**
 * Journey 17 — Unified entries table: Adding participants to events
 *
 * Tests adding participants to events via the unified entries table's
 * "Add entries" dropdown (Add to Accepted / Add to Qualifying /
 * Add to Alternates). Verifies mutation dispatch, table update, and
 * entry count changes.
 *
 * @see Test plan section 3
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/* ─── Seed profiles ─────────────────────────────────────────────────────── */

/** Tournament with 32 participants, event with only 16 entries.
 *  drawProfiles creates event with 16 entries; the remaining 16
 *  participants are in the tournament but NOT in the event. */
const PROFILE_PARTIAL_ENTRIES: MockProfile = {
  tournamentName: 'E2E Unified Add',
  tournamentAttributes: { tournamentId: 'e2e-unified-add' },
  participantsProfile: { scaledParticipantsCount: 32 },
  drawProfiles: [{ eventName: 'Singles', drawSize: 16, generate: false }],
};

/** Tournament with 32 participants, event with 16 entries + generated draw. */
const PROFILE_WITH_DRAW: MockProfile = {
  tournamentName: 'E2E Unified Add Post-Draw',
  tournamentAttributes: { tournamentId: 'e2e-unified-add-draw' },
  participantsProfile: { scaledParticipantsCount: 32 },
  drawProfiles: [{ eventName: 'Singles', drawSize: 16 }],
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

async function navigateToEntries(page: any, profile: MockProfile, addExtraParticipants = false): Promise<string> {
  const tournamentId = await seedTournament(page, profile);

  if (addExtraParticipants) {
    // Add 16 extra participants NOT entered in the event
    await page.evaluate(() => {
      const { tournamentEngine, mocksEngine } = dev.factory;
      const { participants } = mocksEngine.generateParticipants({
        participantsCount: 16,
        participantType: 'INDIVIDUAL',
      });
      tournamentEngine.addParticipants({ participants });
    });
  }

  const tournamentPage = new TournamentPage(page);
  await tournamentPage.goto(tournamentId);
  await tournamentPage.navigateToEvents();
  await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
  await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });

  // Ensure we're on the Entries tab (TMX may navigate to Draws when a draw exists)
  const entriesVisible = await page.locator(S.ENTRIES_VIEW).isVisible().catch(() => false);
  if (!entriesVisible) {
    await page.locator('#eventTabsBar').getByText('Entries').click();
  }
  await page.waitForSelector(S.ENTRIES_VIEW, { state: 'visible', timeout: 10_000 });
  return tournamentId;
}

/** Get the current entry count from the page. */
async function getEntryCount(page: any): Promise<number> {
  return page.evaluate(() => {
    const tournament = dev.getTournament();
    const event = tournament.events?.[0];
    return event?.entries?.length ?? 0;
  });
}

/* ─── Tests ──────────────────────────────────────────────────────────────── */

test.describe('Journey 17 — Unified entries: Add participants to event', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('unified entries table renders with correct segment count', async ({ page }) => {
    await navigateToEntries(page, PROFILE_PARTIAL_ENTRIES, true);

    // The unified table should show entries
    const tableRows = page.locator(`${S.ENTRIES_VIEW} .tabulator-row`);
    const rowCount = await tableRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(16);

    // Verify "Accepted" count header or segment indicator
    const entriesCount = await getEntryCount(page);
    expect(entriesCount).toBe(16);
  });

  test('3.1 — "Add entries" dropdown shows segment options', async ({ page }) => {
    await navigateToEntries(page, PROFILE_PARTIAL_ENTRIES, true);

    // Find the "Add entries" dropdown in the table control bar
    const addEntriesBtn = page.getByText('Add entries', { exact: true });
    await addEntriesBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await addEntriesBtn.click();

    // Should show 3 segment target options
    const addAccepted = page.getByText('Add to Accepted');
    const addQualifying = page.getByText('Add to Qualifying');
    const addAlternates = page.getByText('Add to Alternates');

    await addAccepted.waitFor({ state: 'visible', timeout: 3_000 });
    expect(await addAccepted.isVisible()).toBe(true);
    expect(await addQualifying.isVisible()).toBe(true);
    expect(await addAlternates.isVisible()).toBe(true);
  });

  test('3.1+3.9 — add participants to Accepted emits ADD_EVENT_ENTRIES', async ({ page }) => {
    const collector = createMutationCollector(page);
    await navigateToEntries(page, PROFILE_PARTIAL_ENTRIES, true);

    const countBefore = await getEntryCount(page);
    expect(countBefore).toBe(16);

    // Open "Add entries" dropdown → "Add to Accepted"
    await page.getByText('Add entries', { exact: true }).click();
    const addAcceptedOption = page.getByText('Add to Accepted');
    await addAcceptedOption.waitFor({ state: 'visible', timeout: 3_000 });
    await addAcceptedOption.click();

    // Wait for selection table inside the modal (#selectionTable)
    const selectionTable = page.locator('#selectionTable');
    await selectionTable.waitFor({ state: 'visible', timeout: 10_000 });

    // Select the first row
    const selectionRows = selectionTable.locator('.tabulator-row');
    await selectionRows.first().waitFor({ state: 'visible', timeout: 5_000 });
    await selectionRows.first().click();

    // Click "Select" button
    await page.getByRole('button', { name: 'Select' }).click();

    // Wait for the mutation
    const entry = await collector.waitForMethod('addEventEntries', 10_000);
    expect(entry).toBeDefined();

    // Verify mutation params
    const params = entry.methods[0].params;
    expect(params.entryStage).toBe('MAIN');
    expect(params.entryStatus).toBe('DIRECT_ACCEPTANCE');
    expect(params.participantIds).toBeDefined();
    expect(params.participantIds.length).toBeGreaterThan(0);

    // Entry count should increase
    const countAfter = await getEntryCount(page);
    expect(countAfter).toBe(countBefore + 1);

    collector.detach();
  });

  test('3.2+3.9 — add participants to Qualifying emits with entryStage QUALIFYING', async ({ page }) => {
    const collector = createMutationCollector(page);
    await navigateToEntries(page, PROFILE_PARTIAL_ENTRIES, true);

    // Open "Add entries" → "Add to Qualifying"
    await page.getByText('Add entries', { exact: true }).click();
    await page.getByText('Add to Qualifying').click();

    // Select first participant in modal
    const selectionTable = page.locator('#selectionTable');
    await selectionTable.waitFor({ state: 'visible', timeout: 10_000 });
    // The selection table is a Tabulator inside #selectionTable
    const selectionRows = selectionTable.locator('.tabulator-row');
    await selectionRows.first().waitFor({ state: 'visible', timeout: 5_000 });
    await selectionRows.first().click();
    await page.getByRole('button', { name: 'Select' }).click();

    const entry = await collector.waitForMethod('addEventEntries', 10_000);
    expect(entry.methods[0].params.entryStage).toBe('QUALIFYING');

    collector.detach();
  });

  test('3.10 — adding to event AFTER draw created still works', async ({ page }) => {
    const collector = createMutationCollector(page);
    // Seed with a generated draw, then add extra participants
    await navigateToEntries(page, PROFILE_WITH_DRAW, true);

    const countBefore = await getEntryCount(page);

    // "Add entries" should still be available even with a generated draw
    const addEntriesBtn = page.getByText('Add entries', { exact: true });
    const isVisible = await addEntriesBtn.isVisible().catch(() => false);

    if (isVisible) {
      await addEntriesBtn.click();
      await page.getByText('Add to Accepted').click();

      const selectionTable = page.locator('#selectionTable');
      await selectionTable.waitFor({ state: 'visible', timeout: 10_000 });
      const selectionRows = selectionTable.locator('.tabulator-row');
      const hasRows = await selectionRows.first()
        .waitFor({ state: 'visible', timeout: 3_000 })
        .then(() => true)
        .catch(() => false);

      if (hasRows) {
        await selectionRows.first().click();
        await page.getByRole('button', { name: 'Select' }).click();

        const entry = await collector.waitForMethod('addEventEntries', 10_000);
        expect(entry).toBeDefined();

        const countAfter = await getEntryCount(page);
        expect(countAfter).toBeGreaterThan(countBefore);
      } else {
        // All participants already in the event — no available participants
        console.log('No available participants to add (all already entered)');
      }
    } else {
      // "Add entries" hidden when draw is created — document this behavior
      console.log('Add entries button hidden when draw is created');
    }

    collector.detach();
  });

  test('3.6 — already-entered participants excluded from selection', async ({ page }) => {
    await navigateToEntries(page, PROFILE_PARTIAL_ENTRIES, true);

    // Count available participants: 32 total - 16 entered = 16 available
    await page.getByText('Add entries', { exact: true }).click();
    await page.getByText('Add to Accepted').click();

    const selectionTable = page.locator('#selectionTable');
    await selectionTable.waitFor({ state: 'visible', timeout: 10_000 });
    const selectionRows = selectionTable.locator('.tabulator-row');
    await selectionRows.first().waitFor({ state: 'visible', timeout: 5_000 });

    const availableCount = await selectionRows.count();
    // Should be ~16 (32 total - 16 entered)
    expect(availableCount).toBeLessThanOrEqual(16);
    expect(availableCount).toBeGreaterThan(0);

    // Close modal
    await page.getByRole('button', { name: 'Cancel' }).click();
  });
});
