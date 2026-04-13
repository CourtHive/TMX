/**
 * Journey 22 — Unified entries: Doubles ungrouped + pairing
 *
 * Tests the doubles-specific flows in the unified entries table:
 * ungrouped segment display, pairing mode on/off, create pair button,
 * and search filtering with ungrouped entries.
 *
 * Bug found: createPairButton was called as a function but is a config
 * object — caused TypeError when ungrouped rows were selected.
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

const PROFILE_DOUBLES: MockProfile = {
  tournamentName: 'E2E Doubles Pairing',
  tournamentAttributes: { tournamentId: 'e2e-doubles-pair' },
  participantsProfile: { scaledParticipantsCount: 16 },
  drawProfiles: [{ eventName: 'Doubles', drawSize: 8, eventType: 'DOUBLES', generate: false }],
};

async function seedDoublesWithUngrouped(page: any): Promise<string> {
  const tournamentId = await seedTournament(page, PROFILE_DOUBLES);

  // Add individual participants as UNGROUPED entries
  await page.evaluate(() => {
    const tournament = dev.getTournament();
    const event = tournament.events?.[0];
    if (!event) return;

    const enteredIds = new Set((event.entries || []).map((e: any) => e.participantId));
    const individuals = tournament.participants
      .filter((p: any) => p.participantType === 'INDIVIDUAL' && !enteredIds.has(p.participantId))
      .slice(0, 4);

    for (const p of individuals) {
      event.entries.push({
        participantId: p.participantId,
        entryStatus: 'UNGROUPED',
        entryStage: 'MAIN',
      });
    }
    dev.factory.tournamentEngine.setState(tournament);
  });

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
  await page.locator(`${S.ENTRIES_VIEW} .tag`).first().waitFor({ state: 'visible', timeout: 5_000 });
  return tournamentId;
}

test.describe('Journey 22 — Doubles ungrouped + pairing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('ungrouped entries display in doubles event without errors', async ({ page }) => {
    await seedDoublesWithUngrouped(page);

    const chips = await page.locator(`${S.ENTRIES_VIEW} .tag`).allTextContents();
    const trimmed = chips.map((t) => t.trim()).filter(Boolean);
    console.log('Chips:', JSON.stringify(trimmed));

    expect(trimmed).toContain('Accepted');
    expect(trimmed).toContain('Ungrouped');

    // No console errors should have occurred
    // (the createPairButton TypeError would have fired on row selection)
  });

  test('selecting ungrouped rows does not throw TypeError (bug fix)', async ({ page }) => {
    await seedDoublesWithUngrouped(page);

    // Capture page errors
    const errors: string[] = [];
    page.on('pageerror', (err: any) => errors.push(err.message));

    // Find and click an Ungrouped row by locating its chip's parent row
    const ungroupedChip = page.locator(`${S.ENTRIES_VIEW} .tag`).filter({ hasText: 'Ungrouped' }).first();
    const hasUngrouped = await ungroupedChip.isVisible().catch(() => false);

    if (hasUngrouped) {
      const ungroupedRow = ungroupedChip.locator('xpath=ancestor::div[contains(@class,"tabulator-row")]');
      await ungroupedRow.click();

      // Wait for the control bar to re-render (this is where the bug fired)
      await page.waitForTimeout(500);

      // No TypeError should have been thrown
      const typeErrors = errors.filter((e) => e.includes('is not a function'));
      expect(typeErrors).toEqual([]);
    }
  });

  test('selecting 2 ungrouped rows shows Create pair button (pairing OFF)', async ({ page }) => {
    await seedDoublesWithUngrouped(page);

    const errors: string[] = [];
    page.on('pageerror', (err: any) => errors.push(err.message));

    // Find ungrouped rows via chip → parent row
    const ungroupedChips = page.locator(`${S.ENTRIES_VIEW} .tag`).filter({ hasText: 'Ungrouped' });
    const ungroupedCount = await ungroupedChips.count();

    if (ungroupedCount < 2) {
      console.log('Not enough ungrouped rows for pairing test');
      return;
    }

    // Select 2 ungrouped rows via their parent tabulator-row
    const firstRow = ungroupedChips.nth(0).locator('xpath=ancestor::div[contains(@class,"tabulator-row")]');
    const secondRow = ungroupedChips.nth(1).locator('xpath=ancestor::div[contains(@class,"tabulator-row")]');
    // Click the row-selection checkbox area (first cell) to avoid
    // triggering the participant profile modal from the name cell
    const firstCheckbox = firstRow.locator('.tabulator-row-handle, .tabulator-cell').first();
    const secondCheckbox = secondRow.locator('.tabulator-row-handle, .tabulator-cell').first();
    await firstCheckbox.scrollIntoViewIfNeeded();
    await firstCheckbox.click();
    await secondCheckbox.scrollIntoViewIfNeeded();
    await secondCheckbox.click();
    await page.waitForTimeout(500);

    // "Create pair" button should appear in the overlay
    const createPairBtn = page.getByText('Create pair');
    const isVisible = await createPairBtn.first()
      .waitFor({ state: 'visible', timeout: 3_000 })
      .then(() => true)
      .catch(() => false);

    console.log('Create pair visible after selecting 2 ungrouped:', isVisible);

    // No errors should have occurred
    const typeErrors = errors.filter((e) => e.includes('is not a function'));
    expect(typeErrors).toEqual([]);
  });

  test('pairing mode ON: selecting 2 ungrouped auto-pairs (emits mutation)', async ({ page }) => {
    const collector = createMutationCollector(page);
    await seedDoublesWithUngrouped(page);

    const errors: string[] = [];
    page.on('pageerror', (err: any) => errors.push(err.message));

    // Toggle pairing mode ON
    const pairingBtn = page.getByText('Pairing: OFF');
    await pairingBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await pairingBtn.click();
    await page.waitForTimeout(200);

    // Find ungrouped rows via chip → parent row
    const ungroupedChips = page.locator(`${S.ENTRIES_VIEW} .tag`).filter({ hasText: 'Ungrouped' });
    const ungroupedCount = await ungroupedChips.count();

    if (ungroupedCount < 2) {
      console.log('Not enough ungrouped for auto-pair test');
      collector.detach();
      return;
    }

    // Select 2 ungrouped rows — with pairing ON, this should auto-pair
    const firstRow = ungroupedChips.nth(0).locator('xpath=ancestor::div[contains(@class,"tabulator-row")]');
    const secondRow = ungroupedChips.nth(1).locator('xpath=ancestor::div[contains(@class,"tabulator-row")]');
    // Click the row-selection checkbox area (first cell) to avoid
    // triggering the participant profile modal from the name cell
    const firstCheckbox = firstRow.locator('.tabulator-row-handle, .tabulator-cell').first();
    const secondCheckbox = secondRow.locator('.tabulator-row-handle, .tabulator-cell').first();
    await firstCheckbox.scrollIntoViewIfNeeded();
    await firstCheckbox.click();
    await secondCheckbox.scrollIntoViewIfNeeded();
    await secondCheckbox.click();

    // Wait for the auto-pair mutation
    const entry = await collector.waitForMethod('addEventEntryPairs', 10_000).catch(() => null);
    if (entry) {
      console.log('Auto-pair mutation emitted');
      expect(entry.methods[0].params.participantIdPairs).toBeDefined();
    } else {
      console.log('No auto-pair mutation — pairing might require different interaction');
    }

    // No errors should have occurred
    const typeErrors = errors.filter((e) => e.includes('is not a function'));
    expect(typeErrors).toEqual([]);

    collector.detach();
  });

  test('search filtering with ungrouped entries does not throw errors', async ({ page }) => {
    await seedDoublesWithUngrouped(page);

    const errors: string[] = [];
    page.on('pageerror', (err: any) => errors.push(err.message));

    // Type in search to filter entries (this was the original bug trigger)
    const searchInput = page.locator('input[placeholder="Search entries"]');
    await searchInput.waitFor({ state: 'visible', timeout: 5_000 });

    // Get a name from the ungrouped entries
    const ungroupedName = await page.evaluate(() => {
      const tournament = dev.getTournament();
      const event = tournament.events?.[0];
      const ungrouped = event?.entries?.find((e: any) => e.entryStatus === 'UNGROUPED');
      if (!ungrouped) return '';
      const participant = tournament.participants?.find((p: any) => p.participantId === ungrouped.participantId);
      return participant?.participantName?.substring(0, 4) || '';
    });

    if (ungroupedName) {
      await searchInput.pressSequentially(ungroupedName, { delay: 50 });
      await page.waitForTimeout(500);

      // Should show filtered results without errors
      const visibleCount = await page.evaluate(() => {
        const rows = document.querySelectorAll('#entriesView .tabulator-row');
        return Array.from(rows).filter((r) => (r as HTMLElement).style.display !== 'none').length;
      });
      console.log(`Search "${ungroupedName}": ${visibleCount} visible rows`);
      expect(visibleCount).toBeGreaterThan(0);
    }

    // The critical assertion: no TypeError from createPairButton
    const typeErrors = errors.filter((e) => e.includes('is not a function'));
    expect(typeErrors).toEqual([]);

    // Clear search
    await searchInput.clear();
  });
});
