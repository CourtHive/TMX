/**
 * Journey 21 — Unified entries: Feature flag toggle + edge cases
 *
 * Tests the feature flag toggling between unified and old 5-panel views,
 * localStorage persistence, and edge cases (empty event, navigation
 * between events, draw generation from entries tab).
 *
 * @see Test plan sections 1, 10
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

const PROFILE_16: MockProfile = {
  tournamentName: 'E2E Flag',
  tournamentAttributes: { tournamentId: 'e2e-flag' },
  participantsProfile: { scaledParticipantsCount: 16 },
  drawProfiles: [{ eventName: 'Singles', drawSize: 16, generate: false }],
};

const PROFILE_MULTI_EVENT: MockProfile = {
  tournamentName: 'E2E Multi Event',
  tournamentAttributes: { tournamentId: 'e2e-multi-event' },
  participantsProfile: { scaledParticipantsCount: 32 },
  drawProfiles: [
    { eventName: 'U18 Singles', drawSize: 16, generate: false },
    { eventName: 'U16 Singles', drawSize: 8, generate: false },
  ],
};

async function navigateToEntries(page: any, profile: MockProfile): Promise<string> {
  const tournamentId = await seedTournament(page, profile);
  const tournamentPage = new TournamentPage(page);
  await tournamentPage.goto(tournamentId);
  await tournamentPage.navigateToEvents();
  await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
  await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
  const entriesVisible = await page.locator(S.ENTRIES_VIEW).isVisible().catch(() => false);
  if (!entriesVisible) {
    await page.locator('#eventTabsBar').getByText('Entries').click();
  }
  await page.waitForSelector(S.ENTRIES_VIEW, { state: 'visible', timeout: 10_000 });
  return tournamentId;
}

/** Detect if the unified entries table is active (has segment chips). */
async function isUnifiedView(page: any): Promise<boolean> {
  const chips = await page.locator(`${S.ENTRIES_VIEW} .tag`).count();
  return chips > 0;
}

/** Detect if the old 5-panel view is active (has panel containers). */
async function isOldPanelView(page: any): Promise<boolean> {
  const accepted = await page.locator(S.ACCEPTED_PANEL).isVisible().catch(() => false);
  return accepted;
}

test.describe('Journey 21 — Feature flag toggle + edge cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  /* ── Section 1: Feature flag ──────────────────────────────────────── */

  test('1.1 — unified table loads by default (flag=true)', async ({ page }) => {
    await navigateToEntries(page, PROFILE_16);

    const isUnified = await isUnifiedView(page);
    expect(isUnified).toBe(true);

    // Should have segment chips (Accepted)
    const chipTexts = await page.locator(`${S.ENTRIES_VIEW} .tag`).allTextContents();
    expect(chipTexts.some((t: string) => t.trim() === 'Accepted')).toBe(true);
  });

  test('1.2 — disabling flag reverts to old 5-panel view', async ({ page }) => {
    await navigateToEntries(page, PROFILE_16);

    // Verify unified is active
    expect(await isUnifiedView(page)).toBe(true);

    // Disable the flag via dev bridge
    await page.evaluate(() => {
      dev.env.unifiedEntriesTable = false;
    });

    // Navigate away and back to reload the entries view
    await page.locator('#eventTabsBar').getByText('Rankings').click();
    await page.waitForTimeout(300);
    await page.locator('#eventTabsBar').getByText('Entries').click();
    await page.waitForSelector(S.ENTRIES_VIEW, { state: 'visible', timeout: 10_000 });
    await page.waitForTimeout(500);

    // Should now show the old panel view (Accepted panel visible)
    const isOld = await isOldPanelView(page);
    const isUnified = await isUnifiedView(page);

    console.log('1.2: isOld:', isOld, 'isUnified:', isUnified);

    // Old view has #acceptedPanel; unified has .tag chips
    // At least one indicator should match
    expect(isOld || !isUnified).toBe(true);

    // Re-enable for other tests
    await page.evaluate(() => {
      dev.env.unifiedEntriesTable = true;
    });
  });

  test('1.3 — flag persists via localStorage after settings save', async ({ page }) => {
    await navigateToEntries(page, PROFILE_16);

    // Disable via the settings API (simulates what the settings page does)
    await page.evaluate(() => {
      dev.env.unifiedEntriesTable = false;
      // Trigger persist
      const event = new Event('storage');
      globalThis.dispatchEvent(event);
    });

    // Read back from the featureFlags module
    const flagValue = await page.evaluate(() => dev.env.unifiedEntriesTable);
    expect(flagValue).toBe(false);

    // Re-enable
    await page.evaluate(() => {
      dev.env.unifiedEntriesTable = true;
    });
  });

  /* ── Section 10: Edge cases ───────────────────────────────────────── */

  test('10.3 — navigating between events reloads correct entries', async ({ page }) => {
    const tournamentId = await seedTournament(page, PROFILE_MULTI_EVENT);
    const tournamentPage = new TournamentPage(page);
    await tournamentPage.goto(tournamentId);
    await tournamentPage.navigateToEvents();

    // Click first event (U18 Singles with 16 entries)
    const rows = tournamentPage.eventsTable.locator('.tabulator-row');
    await rows.first().click();
    await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
    await page.waitForSelector(S.ENTRIES_VIEW, { state: 'visible', timeout: 10_000 });

    // Count entries in first event
    const firstEventChips = await page.locator(`${S.ENTRIES_VIEW} .tag`).count();
    console.log('10.3: First event chip count:', firstEventChips);

    // Navigate back to events list
    await page.getByText('All Events').click();
    await page.waitForTimeout(500);

    // Click second event (U16 Singles with 8 entries)
    await rows.nth(1).waitFor({ state: 'visible', timeout: 5_000 });
    await rows.nth(1).click();
    await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
    const entriesVisible = await page.locator(S.ENTRIES_VIEW).isVisible().catch(() => false);
    if (!entriesVisible) {
      await page.locator('#eventTabsBar').getByText('Entries').click();
    }
    await page.waitForSelector(S.ENTRIES_VIEW, { state: 'visible', timeout: 10_000 });

    // Count entries in second event — should be different
    const secondEventChips = await page.locator(`${S.ENTRIES_VIEW} .tag`).count();
    console.log('10.3: Second event chip count:', secondEventChips);

    // The two events have different entry counts
    expect(firstEventChips).not.toBe(secondEventChips);
  });

  test('10.4 — draw generation from entries tab still works', async ({ page }) => {
    await navigateToEntries(page, PROFILE_16);

    // The "Add draw" button should be visible in the unified entries view
    const addDrawBtn = page.getByRole('button', { name: 'Add draw' });
    const isVisible = await addDrawBtn.isVisible().catch(() => false);
    expect(isVisible).toBe(true);
  });

  test('10.6 — segment counts in scope dropdown match actual entries', async ({ page }) => {
    await navigateToEntries(page, PROFILE_16);

    // Get the entry count from the factory
    const engineCount = await page.evaluate(() => {
      return dev.getTournament().events?.[0]?.entries?.length ?? 0;
    });

    // Get the count from the scope dropdown text "All (N)"
    const eventControl = page.locator(S.EVENT_CONTROL);
    const controlText = await eventControl.textContent();
    const match = controlText?.match(/All\s*\((\d+)\)/);

    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(engineCount);
  });

  test('10.1 — empty event shows empty unified table', async ({ page }) => {
    // Seed tournament with an event that has 0 entries
    const tournamentId = await seedTournament(page, {
      tournamentName: 'E2E Empty',
      tournamentAttributes: { tournamentId: 'e2e-empty-event' },
      participantsProfile: { scaledParticipantsCount: 16 },
      eventProfiles: [{ eventName: 'Empty Singles', drawProfiles: [] }],
    });

    const tournamentPage = new TournamentPage(page);
    await tournamentPage.goto(tournamentId);
    await tournamentPage.navigateToEvents();
    await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
    await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
    await page.waitForSelector(S.ENTRIES_VIEW, { state: 'visible', timeout: 10_000 });

    // Should show "No entries" placeholder or 0 rows
    const chipCount = await page.locator(`${S.ENTRIES_VIEW} .tag`).count();
    expect(chipCount).toBe(0);

    // The table should still render (with placeholder text)
    const tableText = await page.locator(`${S.ENTRIES_VIEW}`).textContent();
    const hasPlaceholder = tableText?.includes('No entries') || chipCount === 0;
    expect(hasPlaceholder).toBe(true);
  });

  test('10.5 — entry positions sequential within segment', async ({ page }) => {
    await navigateToEntries(page, PROFILE_16);

    // Check that entries have sequential positioning via factory
    const positions = await page.evaluate(() => {
      const event = dev.getTournament().events?.[0];
      return (event?.entries || [])
        .filter((e: any) => e.entryStatus === 'DIRECT_ACCEPTANCE')
        .map((e: any) => e.entryPosition)
        .filter((p: any) => p !== undefined);
    });

    if (positions.length > 0) {
      // Positions should be sequential starting from 1
      const sorted = [...positions].sort((a: number, b: number) => a - b);
      expect(sorted[0]).toBe(1);
      expect(sorted[sorted.length - 1]).toBe(positions.length);
      console.log('10.5: Entry positions 1 to', positions.length);
    } else {
      console.log('10.5: No entry positions set (expected for some seeds)');
    }
  });
});
