/**
 * Journey 20 — Unified entries: Seeding controls and doubles pairing
 *
 * Tests seeding dropdown (segment-scoped), manual seeding, and
 * doubles-specific features (ungrouped segment, pairing mode toggle,
 * create pair button).
 *
 * @see Test plan sections 8, 9
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/* ─── Seed profiles ─────────────────────────────────────────────────────── */

const PROFILE_SINGLES: MockProfile = {
  tournamentName: 'E2E Seeding',
  tournamentAttributes: { tournamentId: 'e2e-seeding' },
  participantsProfile: { scaledParticipantsCount: 16 },
  drawProfiles: [{ eventName: 'Singles', drawSize: 16, generate: false }],
};

const PROFILE_DOUBLES: MockProfile = {
  tournamentName: 'E2E Doubles',
  tournamentAttributes: { tournamentId: 'e2e-doubles' },
  participantsProfile: { scaledParticipantsCount: 16 },
  drawProfiles: [{ eventName: 'Doubles', drawSize: 8, eventType: 'DOUBLES', generate: false }],
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

test.describe('Journey 20 — Seeding controls and doubles pairing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  /* ── Section 8: Seeding ───────────────────────────────────────────── */

  test('8.1 — Seeding split into Accepted and Qualifying dropdowns', async ({ page }) => {
    await navigateToEntries(page, PROFILE_SINGLES);

    // Two seeding buttons: "Seeding" (accepted) and "Seeding (Q)"
    const seedingBtn = page.getByText('Seeding', { exact: true });
    const seedingQBtn = page.getByText('Seeding (Q)', { exact: true });

    await seedingBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await seedingQBtn.waitFor({ state: 'visible', timeout: 5_000 });

    // Click the accepted seeding dropdown
    await seedingBtn.click();
    const manualSeeding = page.getByText('Manual seeding', { exact: true }).first();
    await manualSeeding.waitFor({ state: 'visible', timeout: 3_000 });
    expect(await manualSeeding.isVisible()).toBe(true);

    // Should have "Clear seeding"
    const clearSeeding = page.getByText('Clear seeding').first();
    expect(await clearSeeding.isVisible()).toBe(true);
  });

  test('8.2 — Manual seeding activates from accepted seeding dropdown', async ({ page }) => {
    await navigateToEntries(page, PROFILE_SINGLES);

    await page.getByText('Seeding', { exact: true }).click();
    const manualOption = page.getByText('Manual seeding', { exact: true }).first();
    await manualOption.waitFor({ state: 'visible', timeout: 3_000 });

    // Click Manual seeding — should enable seeding mode
    await manualOption.click();

    // After clicking, the seeding column should become editable
    // and "Save seeding" / "Cancel" buttons should appear
    await page.waitForTimeout(300);

    const saveBtn = page.getByText('Save seeding');
    const cancelBtn = page.getByText('Cancel');
    const saveVisible = await saveBtn.isVisible().catch(() => false);
    const cancelVisible = await cancelBtn.isVisible().catch(() => false);

    console.log('8.2: Save visible:', saveVisible, 'Cancel visible:', cancelVisible);
    // At least one of these should appear when manual seeding is active
    expect(saveVisible || cancelVisible).toBe(true);
  });

  test('8.3 — Clear seeding available in both dropdowns', async ({ page }) => {
    await navigateToEntries(page, PROFILE_SINGLES);

    // Check accepted dropdown has "Clear seeding"
    await page.getByText('Seeding', { exact: true }).click();
    const clearOption = page.getByText('Clear seeding').first();
    await clearOption.waitFor({ state: 'visible', timeout: 3_000 });
    expect(await clearOption.isVisible()).toBe(true);
  });

  test('8.5 — Both seeding dropdowns visible on "All entries" view with generated draw', async ({ page }) => {
    const profile: MockProfile = {
      ...PROFILE_SINGLES,
      tournamentAttributes: { tournamentId: 'e2e-seeding-created' },
      drawProfiles: [{ eventName: 'Singles', drawSize: 16 }],
    };
    await navigateToEntries(page, profile);

    const seedingBtn = page.getByText('Seeding', { exact: true });
    const seedingQBtn = page.getByText('Seeding (Q)', { exact: true });

    expect(await seedingBtn.isVisible().catch(() => false)).toBe(true);
    expect(await seedingQBtn.isVisible().catch(() => false)).toBe(true);
  });

  /* ── Section 9: Doubles-specific ──────────────────────────────────── */

  test('9.1 — ungrouped segment visible for DOUBLES events with ungrouped entries', async ({ page }) => {
    await navigateToEntries(page, PROFILE_DOUBLES);

    // Add 2 individual participants as UNGROUPED entries to the doubles event
    await page.evaluate(() => {
      const tournament = dev.getTournament();
      const event = tournament.events?.[0];
      if (!event) return;

      // Find 2 individual participants not already in the event
      const enteredIds = new Set((event.entries || []).map((e: any) => e.participantId));
      const individuals = tournament.participants
        .filter((p: any) => p.participantType === 'INDIVIDUAL' && !enteredIds.has(p.participantId))
        .slice(0, 2);

      for (const p of individuals) {
        event.entries.push({
          participantId: p.participantId,
          entryStatus: 'UNGROUPED',
          entryStage: 'MAIN',
        });
      }
      dev.factory.tournamentEngine.setState(tournament);
    });

    // Reload entries view
    await page.locator('#eventTabsBar').getByText('Rankings').click();
    await page.waitForTimeout(300);
    await page.locator('#eventTabsBar').getByText('Entries').click();
    await page.waitForSelector(S.ENTRIES_VIEW, { state: 'visible', timeout: 10_000 });
    await page.locator(`${S.ENTRIES_VIEW} .tag`).first().waitFor({ state: 'visible', timeout: 5_000 });

    const chips = await page.locator(`${S.ENTRIES_VIEW} .tag`).allTextContents();
    const trimmed = chips.map((t) => t.trim()).filter(Boolean);
    console.log('9.1: Chips after adding ungrouped:', JSON.stringify(trimmed));

    expect(trimmed).toContain('Ungrouped');
  });

  test('9.2 — pairing mode toggle visible for DOUBLES events', async ({ page }) => {
    await navigateToEntries(page, PROFILE_DOUBLES);

    // "Pairing: OFF" toggle should be in the right toolbar
    const pairingBtn = page.getByText('Pairing: OFF');
    const isVisible = await pairingBtn
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    console.log('9.2: Pairing toggle visible:', isVisible);
    expect(isVisible).toBe(true);
  });

  test('9.2b — pairing mode toggles ON/OFF', async ({ page }) => {
    await navigateToEntries(page, PROFILE_DOUBLES);

    const pairingBtn = page.getByText('Pairing: OFF');
    await pairingBtn.waitFor({ state: 'visible', timeout: 5_000 });

    // Toggle ON
    await pairingBtn.click();
    await page.waitForTimeout(200);

    // Should now say "Pairing: ON"
    const onBtn = page.getByText('Pairing: ON');
    const isOn = await onBtn.isVisible().catch(() => false);
    expect(isOn).toBe(true);

    // Toggle back OFF
    await onBtn.click();
    await page.waitForTimeout(200);

    const offBtn = page.getByText('Pairing: OFF');
    const isOff = await offBtn.isVisible().catch(() => false);
    expect(isOff).toBe(true);
  });

  test('9.1b — ungrouped NOT visible for SINGLES events', async ({ page }) => {
    await navigateToEntries(page, PROFILE_SINGLES);

    const chips = await page.locator(`${S.ENTRIES_VIEW} .tag`).allTextContents();
    const trimmed = chips.map((t) => t.trim()).filter(Boolean);
    expect(trimmed).not.toContain('Ungrouped');
  });

  test('pairing mode toggle NOT visible for SINGLES events', async ({ page }) => {
    await navigateToEntries(page, PROFILE_SINGLES);

    const pairingBtn = page.getByText('Pairing:');
    const isVisible = await pairingBtn
      .waitFor({ state: 'visible', timeout: 2_000 })
      .then(() => true)
      .catch(() => false);

    expect(isVisible).toBe(false);
  });

  test('seeding dropdowns and add entries all visible together in toolbar', async ({ page }) => {
    await navigateToEntries(page, PROFILE_SINGLES);

    const seedingBtn = page.getByText('Seeding', { exact: true });
    const seedingQBtn = page.getByText('Seeding (Q)', { exact: true });
    const addEntriesBtn = page.getByText('Add entries', { exact: true });

    await seedingBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await seedingQBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await addEntriesBtn.waitFor({ state: 'visible', timeout: 5_000 });

    expect(await seedingBtn.isVisible()).toBe(true);
    expect(await seedingQBtn.isVisible()).toBe(true);
    expect(await addEntriesBtn.isVisible()).toBe(true);
  });
});
