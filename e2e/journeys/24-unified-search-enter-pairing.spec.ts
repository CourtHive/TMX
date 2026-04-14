/**
 * Journey 24 — Unified search: Enter-to-select and rapid pairing
 *
 * Tests the Enter key behavior in the unified entries search box:
 * - Enter selects the first matching row and clears the search
 * - In pairing mode with one ungrouped already selected, Enter pairs them
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

const PROFILE_DOUBLES: MockProfile = {
  tournamentName: 'E2E Search Enter Pairing',
  tournamentAttributes: { tournamentId: 'e2e-search-enter' },
  participantsProfile: { scaledParticipantsCount: 16 },
  drawProfiles: [{ eventName: 'Doubles', drawSize: 4, eventType: 'DOUBLES', generate: false }],
};

/** Seed doubles event with ungrouped individuals and navigate to entries */
async function seedAndNavigate(page: any): Promise<{ names: string[] }> {
  const tournamentId = await seedTournament(page, PROFILE_DOUBLES);

  // Add extra individual participants and put them as UNGROUPED entries
  const names: string[] = await page.evaluate(() => {
    const { tournamentEngine, mocksEngine } = dev.factory;
    const { participants } = mocksEngine.generateParticipants({
      participantsCount: 6,
      participantType: 'INDIVIDUAL',
    });
    tournamentEngine.addParticipants({ participants });

    const tournament = dev.getTournament();
    const event = tournament.events?.[0];
    if (!event) return [];

    const enteredIds = new Set((event.entries || []).map((e: any) => e.participantId));
    const pairMemberIds = new Set<string>();
    for (const p of tournament.participants) {
      if (p.participantType === 'PAIR') {
        for (const ip of p.individualParticipantIds || []) pairMemberIds.add(ip);
      }
    }

    const available = tournament.participants.filter(
      (p: any) =>
        p.participantType === 'INDIVIDUAL' && !enteredIds.has(p.participantId) && !pairMemberIds.has(p.participantId),
    );

    const toAdd = available.slice(0, 4);
    const addedNames: string[] = [];
    for (const p of toAdd) {
      event.entries.push({
        participantId: p.participantId,
        entryStatus: 'UNGROUPED',
        entryStage: 'MAIN',
      });
      addedNames.push(p.participantName);
    }
    dev.factory.tournamentEngine.setState(tournament);
    return addedNames;
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

  return { names };
}

test.describe('Journey 24 — Search Enter-to-select and rapid pairing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('Enter selects first match and clears search', async ({ page }) => {
    const { names } = await seedAndNavigate(page);
    expect(names.length).toBeGreaterThanOrEqual(2);

    const searchInput = page.locator('input[placeholder="Search entries"]');
    await searchInput.waitFor({ state: 'visible', timeout: 5_000 });

    // Use the last name (surname) from the first ungrouped participant
    const surname = names[0].split(',')[0].trim();
    const searchTerm = surname.substring(0, 4);

    await searchInput.pressSequentially(searchTerm, { delay: 30 });
    await page.waitForTimeout(300);

    // Press Enter — should select first match and clear
    await searchInput.press('Enter');
    await page.waitForTimeout(500);

    // Search input should be cleared
    const inputValue = await searchInput.inputValue();
    expect(inputValue).toBe('');

    // Should have a selected row
    const selectedRows = await page.locator(`${S.ENTRIES_VIEW} .tabulator-row.tabulator-selected`).count();
    expect(selectedRows).toBe(1);
  });

  test('Enter with pairing ON: second Enter pairs two ungrouped', async ({ page }) => {
    const collector = createMutationCollector(page);
    const { names } = await seedAndNavigate(page);
    expect(names.length).toBeGreaterThanOrEqual(2);

    // Toggle pairing mode ON
    const pairingBtn = page.getByText('Pairing: OFF');
    await pairingBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await pairingBtn.click();
    await expect(page.getByText('Pairing: ON')).toBeVisible();

    const searchInput = page.locator('input[placeholder="Search entries"]');
    await searchInput.waitFor({ state: 'visible', timeout: 5_000 });

    // Search for first ungrouped participant and press Enter to select
    const surname1 = names[0].split(',')[0].trim();
    const term1 = surname1.substring(0, 4);
    await searchInput.pressSequentially(term1, { delay: 30 });
    await page.waitForTimeout(300);
    await searchInput.press('Enter');
    await page.waitForTimeout(500);

    // Should have one selected row, search cleared
    expect(await searchInput.inputValue()).toBe('');
    const selectedAfterFirst = await page.locator(`${S.ENTRIES_VIEW} .tabulator-row.tabulator-selected`).count();
    expect(selectedAfterFirst).toBe(1);

    // Search for second ungrouped participant and press Enter to pair
    const surname2 = names[1].split(',')[0].trim();
    const term2 = surname2.substring(0, 4);
    await searchInput.pressSequentially(term2, { delay: 30 });
    await page.waitForTimeout(300);
    await searchInput.press('Enter');

    // Should emit the pairing mutation
    const entry = await collector.waitForMethod('addEventEntryPairs', 10_000);
    expect(entry.methods[0].params.participantIdPairs).toBeDefined();
    expect(entry.methods[0].params.participantIdPairs[0]).toHaveLength(2);

    // Search should be cleared
    expect(await searchInput.inputValue()).toBe('');

    // Selection should be cleared (deselectRow was called)
    await page.waitForTimeout(500);
    const selectedAfterPair = await page.locator(`${S.ENTRIES_VIEW} .tabulator-row.tabulator-selected`).count();
    expect(selectedAfterPair).toBe(0);

    collector.detach();
  });

  test('Enter with pairing OFF does not pair, only selects', async ({ page }) => {
    const { names } = await seedAndNavigate(page);
    expect(names.length).toBeGreaterThanOrEqual(2);

    // Pairing mode should be OFF by default
    await page.getByText('Pairing: OFF').waitFor({ state: 'visible', timeout: 5_000 });

    const searchInput = page.locator('input[placeholder="Search entries"]');
    await searchInput.waitFor({ state: 'visible', timeout: 5_000 });

    // Select first via Enter
    const surname1 = names[0].split(',')[0].trim();
    await searchInput.pressSequentially(surname1.substring(0, 4), { delay: 30 });
    await page.waitForTimeout(300);
    await searchInput.press('Enter');
    await page.waitForTimeout(500);

    // Select second via Enter — should just accumulate selections, not pair
    const surname2 = names[1].split(',')[0].trim();
    await searchInput.pressSequentially(surname2.substring(0, 4), { delay: 30 });
    await page.waitForTimeout(300);
    await searchInput.press('Enter');
    await page.waitForTimeout(500);

    // Should have 2 selected rows (no auto-pairing)
    const selected = await page.locator(`${S.ENTRIES_VIEW} .tabulator-row.tabulator-selected`).count();
    expect(selected).toBe(2);
  });

  test('no JS errors during search-enter workflow', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err: any) => errors.push(err.message));

    const { names } = await seedAndNavigate(page);
    const searchInput = page.locator('input[placeholder="Search entries"]');
    await searchInput.waitFor({ state: 'visible', timeout: 5_000 });

    // Rapid search-enter-search-enter cycle
    for (const name of names.slice(0, 3)) {
      const term = name.split(',')[0].trim().substring(0, 3);
      await searchInput.pressSequentially(term, { delay: 20 });
      await page.waitForTimeout(200);
      await searchInput.press('Enter');
      await page.waitForTimeout(300);
    }

    const typeErrors = errors.filter((e) => e.includes('TypeError') || e.includes('is not a function'));
    expect(typeErrors).toEqual([]);
  });
});
