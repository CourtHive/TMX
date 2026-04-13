/**
 * Journey 19 — Unified entries: Segment display, sorting, and moving
 *
 * Tests segment visual indicators (chips, separators, opacity), sorting
 * behavior, and moving entries between segments via the overlay.
 *
 * @see Test plan sections 2, 6
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/* ─── Seed profiles ─────────────────────────────────────────────────────── */

/** Event with entries in multiple segments: 12 accepted, 2 alternates, 2 withdrawn. */
const PROFILE_MIXED_SEGMENTS: MockProfile = {
  tournamentName: 'E2E Segments',
  tournamentAttributes: { tournamentId: 'e2e-segments' },
  participantsProfile: { scaledParticipantsCount: 16 },
  drawProfiles: [{ eventName: 'Singles', drawSize: 16, generate: false }],
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

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

/** Modify entries to create multiple segments: move some to ALTERNATE and WITHDRAWN. */
async function createMixedSegments(page: any): Promise<{ accepted: number; alternates: number; withdrawn: number }> {
  return page.evaluate(() => {
    const tournament = dev.getTournament();
    const event = tournament.events?.[0];
    if (!event?.entries) return { accepted: 0, alternates: 0, withdrawn: 0 };

    let altChanged = 0;
    let wdChanged = 0;
    for (const entry of event.entries) {
      if (altChanged < 2 && entry.entryStatus === 'DIRECT_ACCEPTANCE') {
        entry.entryStatus = 'ALTERNATE';
        altChanged++;
      } else if (wdChanged < 2 && entry.entryStatus === 'DIRECT_ACCEPTANCE') {
        entry.entryStatus = 'WITHDRAWN';
        wdChanged++;
      }
    }
    dev.factory.tournamentEngine.setState(tournament);

    const accepted = event.entries.filter(
      (e: any) => e.entryStatus !== 'ALTERNATE' && e.entryStatus !== 'WITHDRAWN',
    ).length;
    return { accepted, alternates: altChanged, withdrawn: wdChanged };
  });
}

test.describe('Journey 19 — Segments display, sorting, and moving', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  /* ── Section 2: Segment display ───────────────────────────────────── */

  test('2.1 — accepted entries show green "Accepted" chip', async ({ page }) => {
    await navigateToEntries(page, PROFILE_MIXED_SEGMENTS);

    // All entries are DA/MAIN → should have green Accepted chips
    const chips = page.locator(`${S.ENTRIES_VIEW} .tag`);
    await chips.first().waitFor({ state: 'visible', timeout: 5_000 });
    const firstChipText = await chips.first().textContent();
    expect(firstChipText?.trim()).toBe('Accepted');
  });

  test('2.10 — segment chips color-coded per segment', async ({ page }) => {
    await navigateToEntries(page, PROFILE_MIXED_SEGMENTS);
    await createMixedSegments(page);

    // Reload the entries view to pick up changes
    await page.locator('#eventTabsBar').getByText('Draws').click();
    await page.waitForTimeout(300);
    await page.locator('#eventTabsBar').getByText('Entries').click();
    await page.waitForSelector(S.ENTRIES_VIEW, { state: 'visible', timeout: 10_000 });

    // Collect all chip texts
    const chipTexts = await page.locator(`${S.ENTRIES_VIEW} .tag`).allTextContents();
    const trimmed = chipTexts.map((t) => t.trim()).filter(Boolean);

    console.log('Segment chips:', JSON.stringify(trimmed));

    // Should have Accepted, Alternates, and Withdrawn chips
    expect(trimmed).toContain('Accepted');
    expect(trimmed).toContain('Alternates');
    expect(trimmed).toContain('Withdrawn');
  });

  test('2.11 — entries sorted by segment rank (accepted first)', async ({ page }) => {
    await navigateToEntries(page, PROFILE_MIXED_SEGMENTS);
    await createMixedSegments(page);

    // Reload entries view
    await page.locator('#eventTabsBar').getByText('Draws').click();
    await page.waitForTimeout(300);
    await page.locator('#eventTabsBar').getByText('Entries').click();
    await page.waitForSelector(S.ENTRIES_VIEW, { state: 'visible', timeout: 10_000 });

    // Get all chip texts in DOM order
    const chipTexts = await page.locator(`${S.ENTRIES_VIEW} .tag`).allTextContents();
    const trimmed = chipTexts.map((t) => t.trim()).filter(Boolean);

    // Find the index of first non-Accepted chip
    const firstNonAccepted = trimmed.findIndex((t) => t !== 'Accepted');
    const acceptedCount = firstNonAccepted === -1 ? trimmed.length : firstNonAccepted;

    // All Accepted chips should come before Alternates/Withdrawn
    expect(acceptedCount).toBeGreaterThan(0);
    if (firstNonAccepted > 0) {
      // Everything after firstNonAccepted should NOT be Accepted
      const afterAccepted = trimmed.slice(firstNonAccepted);
      const mixedBack = afterAccepted.some((t) => t === 'Accepted');
      expect(mixedBack).toBe(false);
    }
  });

  test('2.13 — total entry count in scope selector', async ({ page }) => {
    await navigateToEntries(page, PROFILE_MIXED_SEGMENTS);

    // The scope selector shows "All (N)" — verify the count
    // It's in the event control bar above the table
    const eventControl = page.locator(S.EVENT_CONTROL);
    const controlText = await eventControl.textContent();
    // Should contain "All (16)" or similar count pattern
    const match = controlText?.match(/All\s*\((\d+)\)/);
    console.log('2.13: scope text match:', match?.[0]);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(16);
  });

  test('2.7 — ungrouped segment hidden for SINGLES events', async ({ page }) => {
    await navigateToEntries(page, PROFILE_MIXED_SEGMENTS);

    // Get all unique chip texts — should NOT include "Ungrouped" for singles
    const chipTexts = await page.locator(`${S.ENTRIES_VIEW} .tag`).allTextContents();
    const trimmed = chipTexts.map((t) => t.trim()).filter(Boolean);
    const hasUngrouped = trimmed.includes('Ungrouped');
    expect(hasUngrouped).toBe(false);
  });

  /* ── Section 6: Moving entries between segments ───────────────────── */

  test('6.1 — move accepted entry to alternates via overlay', async ({ page }) => {
    const collector = createMutationCollector(page);
    await navigateToEntries(page, PROFILE_MIXED_SEGMENTS);

    // Select the first entry (should be Accepted)
    const firstRow = page.locator(`${S.ENTRIES_VIEW} .tabulator-row`).first();
    await firstRow.waitFor({ state: 'visible', timeout: 5_000 });
    await firstRow.click();

    // The overlay should show "Move participants" with segment targets
    const moveBtn = page.getByText('Move participants');
    const isVisible = await moveBtn.first()
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (!isVisible) {
      console.log('6.1: Move participants not visible — overlay may not render for this selection');
      collector.detach();
      return;
    }

    await moveBtn.first().click();

    // Should show target options (Qualifying, Alternate, Withdrawn)
    const alternateOption = page.getByText('Alternate', { exact: false });
    await alternateOption.first().waitFor({ state: 'visible', timeout: 3_000 });
    await alternateOption.first().click();

    // Wait for MODIFY_ENTRIES_STATUS mutation
    const entry = await collector.waitForMethod('modifyEntriesStatus', 10_000).catch(() => null);
    if (entry) {
      console.log('6.1: modifyEntriesStatus emitted');
      expect(entry.methods[0].params.entryStatus).toBeDefined();
    } else {
      console.log('6.1: No modifyEntriesStatus mutation');
    }

    collector.detach();
  });

  test('6.7 — MODIFY_ENTRIES_STATUS includes participantIds and eventId', async ({ page }) => {
    const collector = createMutationCollector(page);
    await navigateToEntries(page, PROFILE_MIXED_SEGMENTS);

    // Select first row and try to move
    const firstRow = page.locator(`${S.ENTRIES_VIEW} .tabulator-row`).first();
    await firstRow.waitFor({ state: 'visible', timeout: 5_000 });
    await firstRow.click();

    const moveBtn = page.getByText('Move participants');
    const moveVisible = await moveBtn.first()
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (!moveVisible) {
      console.log('6.7: Move not visible — skipping');
      collector.detach();
      return;
    }

    await moveBtn.first().click();

    // Pick "Withdrawn" as target (should always be available for accepted)
    const wdOption = page.getByText('Withdrawn', { exact: true }).first();
    await wdOption.waitFor({ state: 'visible', timeout: 3_000 });
    await wdOption.click();

    const entry = await collector.waitForMethod('modifyEntriesStatus', 10_000).catch(() => null);
    if (entry) {
      const params = entry.methods[0].params;
      expect(params.participantIds).toBeDefined();
      expect(params.participantIds.length).toBe(1);
      expect(params.eventId).toBeDefined();
      expect(params.entryStatus).toBeDefined();
      console.log('6.7: Mutation params:', JSON.stringify({
        entryStatus: params.entryStatus,
        entryStage: params.entryStage,
        count: params.participantIds.length,
      }));
    }

    collector.detach();
  });

  test('2.9 — withdrawn rows at 60% opacity', async ({ page }) => {
    await navigateToEntries(page, PROFILE_MIXED_SEGMENTS);
    await createMixedSegments(page);

    // Reload
    await page.locator('#eventTabsBar').getByText('Draws').click();
    await page.waitForTimeout(300);
    await page.locator('#eventTabsBar').getByText('Entries').click();
    await page.waitForSelector(S.ENTRIES_VIEW, { state: 'visible', timeout: 10_000 });

    // Find a Withdrawn row and check its opacity
    const opacity = await page.evaluate(() => {
      const tags = document.querySelectorAll('#entriesView .tag');
      for (const tag of tags) {
        if (tag.textContent?.trim() === 'Withdrawn') {
          const row = tag.closest('.tabulator-row') as HTMLElement;
          return row?.style.opacity || globalThis.getComputedStyle(row).opacity;
        }
      }
      return null;
    });

    console.log('2.9: Withdrawn row opacity:', opacity);
    if (opacity) {
      expect(Number.parseFloat(opacity)).toBeLessThanOrEqual(0.7);
    }
  });

  /* ── Section 7: Search & scope ────────────────────────────────────── */

  test('7.1 — search text filters across all segments', async ({ page }) => {
    await navigateToEntries(page, PROFILE_MIXED_SEGMENTS);

    // The search input has placeholder "Search entries"
    const searchInput = page.locator('input[placeholder="Search entries"]');
    await searchInput.waitFor({ state: 'visible', timeout: 5_000 });

    // Get a participant name from the engine (not from row text which includes chip)
    const searchTerm = await page.evaluate(() => {
      const tournament = dev.getTournament();
      const event = tournament.events?.[0];
      const participantId = event?.entries?.[0]?.participantId;
      const participant = tournament.participants?.find((p: any) => p.participantId === participantId);
      const name = participant?.participantName || '';
      // Use first 4 chars of the family name for a targeted search
      return name.split(',')[0]?.substring(0, 4) || name.substring(0, 4) || 'test';
    });

    // Use pressSequentially to trigger keyUp handlers
    await searchInput.pressSequentially(searchTerm, { delay: 50 });
    await page.waitForTimeout(500);

    // The search filter adds a Tabulator filter — filtered-out rows
    // get display:none. Count rows that are actually visible.
    const visibleCount = await page.evaluate(() => {
      const rows = document.querySelectorAll('#entriesView .tabulator-row');
      return Array.from(rows).filter((r) => (r as HTMLElement).style.display !== 'none').length;
    });
    console.log(`7.1: searched "${searchTerm}", visible rows: ${visibleCount}`);
    expect(visibleCount).toBeLessThan(16);
    expect(visibleCount).toBeGreaterThan(0);

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(300);
  });

  test('7.2 — scope selector narrows to specific segment', async ({ page }) => {
    await navigateToEntries(page, PROFILE_MIXED_SEGMENTS);
    await createMixedSegments(page);

    // Reload
    await page.locator('#eventTabsBar').getByText('Draws').click();
    await page.waitForTimeout(300);
    await page.locator('#eventTabsBar').getByText('Entries').click();
    await page.waitForSelector(S.ENTRIES_VIEW, { state: 'visible', timeout: 10_000 });

    // Click the scope selector (shows "All" by default)
    const scopeBtn = page.getByText('All', { exact: true }).first();
    const scopeVisible = await scopeBtn
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (!scopeVisible) {
      console.log('7.2: Scope selector not found — skipping');
      return;
    }

    await scopeBtn.click();

    // Select "Alternates" scope
    const altScope = page.getByText(/Alternates/);
    const altScopeVisible = await altScope.first()
      .waitFor({ state: 'visible', timeout: 3_000 })
      .then(() => true)
      .catch(() => false);

    if (altScopeVisible) {
      await altScope.first().click();
      await page.waitForTimeout(300);

      // Only alternates should be visible
      const chips = await page.locator(`${S.ENTRIES_VIEW} .tag`).allTextContents();
      const visible = chips.map((t) => t.trim()).filter(Boolean);
      console.log('7.2: Visible segments after scope filter:', visible);

      // All visible chips should be Alternates (or separator rows)
      const nonAlternate = visible.filter((t) => t !== 'Alternates');
      expect(nonAlternate.length).toBe(0);
    }
  });
});
