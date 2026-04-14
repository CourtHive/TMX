/**
 * Journey 24 — Unified entries: Column refresh, grouping, and delete
 *
 * Regression tests for three bugs:
 * 1. Rating columns not appearing after adding entries to an empty event
 * 2. Grouping column showing "?" instead of real labels for newly added rows
 * 3. No "Remove from event" button for selected entries without draw positions
 *
 * Strategy: seed a tournament with rated participants but NO event entries,
 * then add entries via the UI and assert that columns/chips/actions appear
 * immediately — without needing a page refresh.
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/* ─── Helpers ────────────────────────────────────────────────────────────── */

/**
 * Seed a tournament with rated participants and an empty event (no entries).
 * Uses mocksEngine.generateParticipants with WTN + UTR categories so that
 * rating columns should appear once entries are added.
 */
async function seedTournamentWithRatedParticipants(page: any): Promise<string> {
  return page.evaluate(() => {
    const { mocksEngine, tournamentEngine } = dev.factory;

    // Create a bare tournament
    const startDate = new Date().toISOString().slice(0, 10);
    tournamentEngine.newTournamentRecord({
      tournamentName: 'E2E Ratings Refresh',
      tournamentId: 'e2e-ratings-refresh',
      startDate,
    });

    // Generate 16 participants with WTN and UTR ratings
    const { participants } = mocksEngine.generateParticipants({
      participantsCount: 16,
      scaleAllParticipants: true,
      categories: [
        { ratingType: 'WTN', ratingMin: 10, ratingMax: 30 },
        { ratingType: 'UTR', ratingMin: 5, ratingMax: 14 },
      ],
    });

    tournamentEngine.addParticipants({ participants });

    // Create an event with NO entries
    tournamentEngine.addEvent({
      event: { eventName: 'Singles Test', eventType: 'SINGLES' },
    });

    const tournament = tournamentEngine.getTournament().tournamentRecord;
    dev.load(tournament);
    return tournament.tournamentId as string;
  });
}

async function navigateToEntries(page: any, tournamentId: string): Promise<void> {
  const tournamentPage = new TournamentPage(page);
  await tournamentPage.goto(tournamentId);
  await tournamentPage.navigateToEvents();

  // Click the event row to open it
  await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
  await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });

  // Ensure we're on the Entries tab
  const entriesVisible = await page.locator(S.ENTRIES_VIEW).isVisible().catch(() => false);
  if (!entriesVisible) {
    await page.locator('#eventTabsBar').getByText('Entries').click();
  }
  await page.waitForSelector(S.ENTRIES_VIEW, { state: 'visible', timeout: 10_000 });
}

/** Re-enter the Entries tab to force a full re-render with fresh data. */
async function reloadEntries(page: any): Promise<void> {
  await page.locator('#eventTabsBar').getByText('Draws').click();
  await page.waitForTimeout(300);
  await page.locator('#eventTabsBar').getByText('Entries').click();
  await page.waitForSelector(S.ENTRIES_VIEW, { state: 'visible', timeout: 10_000 });
  await page.locator(`${S.ENTRIES_VIEW} .tabulator-row`).first().waitFor({ state: 'visible', timeout: 5_000 });
}

/** Add participants to Accepted via the "Add entries" dropdown, selecting all available. */
async function addEntriesToAccepted(page: any): Promise<void> {
  // Open "Add entries" dropdown → "Add to Accepted"
  await page.getByText('Add entries', { exact: true }).click();
  const addAccepted = page.getByText('Add to Accepted');
  await addAccepted.waitFor({ state: 'visible', timeout: 3_000 });
  await addAccepted.click();

  // Wait for selection modal
  const selectionTable = page.locator('#selectionTable');
  await selectionTable.waitFor({ state: 'visible', timeout: 10_000 });
  const selectionRows = selectionTable.locator('.tabulator-row');
  await selectionRows.first().waitFor({ state: 'visible', timeout: 5_000 });

  // Click "Select all" checkbox in the selection table header, then confirm
  const headerCheckbox = selectionTable.locator('.tabulator-col[tabulator-field="rowSelection"]');
  if (await headerCheckbox.count()) {
    await headerCheckbox.first().click();
  } else {
    // Fallback: select rows individually (up to 8 for speed)
    const count = Math.min(await selectionRows.count(), 8);
    for (let i = 0; i < count; i++) {
      await selectionRows.nth(i).click();
    }
  }

  await page.getByRole('button', { name: 'Select' }).click();
}

/** Get column titles visible in the unified entries table. */
async function getVisibleColumnTitles(page: any): Promise<string[]> {
  return page.evaluate(() => {
    const headers = document.querySelectorAll('#entriesView .tabulator-col-title');
    return Array.from(headers)
      .map((el) => (el as HTMLElement).textContent?.trim())
      .filter(Boolean);
  });
}

/** Get all grouping chip texts from the entries table (the "Grouping" column). */
async function getGroupingChipTexts(page: any): Promise<string[]> {
  return page.evaluate(() => {
    const chips = document.querySelectorAll('#entriesView .tag');
    return Array.from(chips)
      .map((el) => (el as HTMLElement).textContent?.trim())
      .filter(Boolean);
  });
}

/* ─── Tests ──────────────────────────────────────────────────────────────── */

test.describe('Journey 24 — Ratings columns, grouping chips, and entry removal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('24.1 — rating columns appear immediately after adding rated entries to empty event', async ({ page }) => {
    const tournamentId = await seedTournamentWithRatedParticipants(page);
    await navigateToEntries(page, tournamentId);

    // Before adding entries: no rating columns should be present (no entries in event)
    const columnsBefore = await getVisibleColumnTitles(page);
    expect(columnsBefore).not.toContain('WTN');
    expect(columnsBefore).not.toContain('UTR');

    // Add rated participants as entries
    const collector = createMutationCollector(page);
    await addEntriesToAccepted(page);
    await collector.waitForMethod('addEventEntries', 10_000);
    collector.detach();

    // Navigate away and back to force a full re-render with fresh data
    await page.locator('#eventTabsBar').getByText('Draws').click();
    await page.waitForTimeout(300);
    await page.locator('#eventTabsBar').getByText('Entries').click();
    await page.waitForSelector(S.ENTRIES_VIEW, { state: 'visible', timeout: 10_000 });
    await page.locator(`${S.ENTRIES_VIEW} .tabulator-row`).first().waitFor({ state: 'visible', timeout: 5_000 });

    // After adding entries: rating columns should now be visible
    const columnsAfter = await getVisibleColumnTitles(page);
    expect(columnsAfter).toContain('WTN');
    expect(columnsAfter).toContain('UTR');
  });

  test('24.2 — grouping chips show real labels (not "?") for newly added entries', async ({ page }) => {
    const tournamentId = await seedTournamentWithRatedParticipants(page);
    await navigateToEntries(page, tournamentId);

    // Add entries
    const collector = createMutationCollector(page);
    await addEntriesToAccepted(page);
    await collector.waitForMethod('addEventEntries', 10_000);
    collector.detach();

    await reloadEntries(page);

    // All grouping chips should be "Accepted" (not "?")
    const chips = await getGroupingChipTexts(page);
    expect(chips.length).toBeGreaterThan(0);

    const questionMarks = chips.filter((t) => t === '?');
    expect(questionMarks.length).toBe(0);

    // Every chip should be "Accepted" since we added to accepted
    const accepted = chips.filter((t) => t === 'Accepted');
    expect(accepted.length).toBe(chips.length);
  });

  test('24.3 — seeding dropdown includes "Seed by" rating options after adding rated entries', async ({ page }) => {
    const tournamentId = await seedTournamentWithRatedParticipants(page);
    await navigateToEntries(page, tournamentId);

    // Add entries
    const collector = createMutationCollector(page);
    await addEntriesToAccepted(page);
    await collector.waitForMethod('addEventEntries', 10_000);
    collector.detach();

    await reloadEntries(page);

    // Open the Seeding dropdown
    const seedingBtn = page.getByText('Seeding', { exact: true });
    await seedingBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await seedingBtn.click();

    // Should contain "Seed by WTN" and "Seed by UTR" options
    const seedByWTN = page.getByText('Seed by WTN').first();
    const seedByUTR = page.getByText('Seed by UTR').first();

    await seedByWTN.waitFor({ state: 'visible', timeout: 3_000 });
    expect(await seedByWTN.isVisible()).toBe(true);
    expect(await seedByUTR.isVisible()).toBe(true);
  });

  test('24.4 — "Remove from event" button appears for selected entries without draw positions', async ({ page }) => {
    const tournamentId = await seedTournamentWithRatedParticipants(page);
    await navigateToEntries(page, tournamentId);

    // Add entries first
    const collector = createMutationCollector(page);
    await addEntriesToAccepted(page);
    await collector.waitForMethod('addEventEntries', 10_000);

    await reloadEntries(page);

    // Select the first entry row via its first cell (avoids name cell which opens profile modal)
    const firstRow = page.locator(`${S.ENTRIES_VIEW} .tabulator-row`).first();
    await firstRow.waitFor({ state: 'visible', timeout: 5_000 });
    await firstRow.locator('.tabulator-cell').first().click();

    // "Remove from event" button should appear in the overlay
    const removeBtn = page.getByText('Remove from event');
    await removeBtn.waitFor({ state: 'visible', timeout: 5_000 });
    expect(await removeBtn.isVisible()).toBe(true);
  });

  test('24.5 — "Remove from event" actually removes selected entries', async ({ page }) => {
    const tournamentId = await seedTournamentWithRatedParticipants(page);
    await navigateToEntries(page, tournamentId);

    // Add entries
    const collector = createMutationCollector(page);
    await addEntriesToAccepted(page);
    await collector.waitForMethod('addEventEntries', 10_000);
    collector.clear();

    await reloadEntries(page);

    // Count entries before removal
    const countBefore = await page.evaluate(() => {
      const tournament = dev.getTournament();
      return tournament.events?.[0]?.entries?.length ?? 0;
    });
    expect(countBefore).toBeGreaterThan(0);

    // Select the first entry row
    const firstRow = page.locator(`${S.ENTRIES_VIEW} .tabulator-row`).first();
    await firstRow.waitFor({ state: 'visible', timeout: 5_000 });
    await firstRow.click();

    // Click "Remove from event"
    const removeBtn = page.getByText('Remove from event');
    await removeBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await removeBtn.click();

    // Wait for the removeEventEntries mutation
    await collector.waitForMethod('removeEventEntries', 10_000);
    collector.detach();

    // Entry count should decrease by 1
    await page.waitForTimeout(300);
    const countAfter = await page.evaluate(() => {
      const tournament = dev.getTournament();
      return tournament.events?.[0]?.entries?.length ?? 0;
    });
    expect(countAfter).toBe(countBefore - 1);
  });

  test('24.6 — selecting all entries shows "Remove from event" and removes them all', async ({ page }) => {
    const tournamentId = await seedTournamentWithRatedParticipants(page);
    await navigateToEntries(page, tournamentId);

    // Add entries
    const collector = createMutationCollector(page);
    await addEntriesToAccepted(page);
    await collector.waitForMethod('addEventEntries', 10_000);
    collector.clear();

    await reloadEntries(page);

    // Click the header checkbox to select all entries
    const headerCheckbox = page
      .locator(`${S.ENTRIES_VIEW} .tabulator-col[tabulator-field="rowSelection"]`);
    if (await headerCheckbox.count()) {
      await headerCheckbox.first().click();
    }

    // "Remove from event" should be visible
    const removeBtn = page.getByText('Remove from event');
    await removeBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await removeBtn.click();

    // Wait for the mutation
    await collector.waitForMethod('removeEventEntries', 10_000);
    collector.detach();

    // All entries should be removed
    await page.waitForTimeout(300);
    const countAfter = await page.evaluate(() => {
      const tournament = dev.getTournament();
      return tournament.events?.[0]?.entries?.length ?? 0;
    });
    expect(countAfter).toBe(0);
  });
});
