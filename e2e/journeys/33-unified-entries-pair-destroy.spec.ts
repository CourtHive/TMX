/**
 * Journey 33 — Unified entries: create-pair row-selection crash + destroy pairs
 *
 * Regression tests for two bugs introduced when the legacy split-by-status
 * entries table was retired (commit 9ed8c533):
 *
 *   Bug A (row selection after refresh): after a mutation refresh, a deleted or
 *     recycled Tabulator row can linger in the DOM with a stale click listener.
 *     Clicking it crashed Tabulator's _selectRow:
 *       "Cannot read properties of undefined (reading 'add')"
 *     because row.getElement() returned a wiped `false`. The unified table's
 *     selectableRowsCheck now rejects rows with no backing element, so the
 *     click is a no-op instead of a crash. (33.3 reproduces this deterministically.)
 *
 *   Bug B (destroy pairs): the "Destroy pairs" action wrote to
 *     context.tables[UNGROUPED], which no longer exists in the single-table
 *     unified layout → threw. Destroying a pair must return both individuals
 *     to the UNGROUPED segment without crashing. (33.2)
 *
 * Note on assertions: e2e runs local-only and the IndexedDB save after a
 * mutation can intermittently throw (DexieError), which aborts the in-place
 * refresh callback. The factory engine is always updated, so DOM assertions
 * navigate away and back (re-rendering from the engine) — the same pattern
 * journey 24 uses.
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { createMutationCollector } from '../helpers/mutation-collector';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

const PROFILE_DOUBLES: MockProfile = {
  tournamentName: 'E2E Pair Destroy',
  tournamentAttributes: { tournamentId: 'e2e-pair-destroy' },
  participantsProfile: { scaledParticipantsCount: 16 },
  drawProfiles: [{ eventName: 'Doubles', drawSize: 8, eventType: 'DOUBLES', generate: false }],
};

/** Seed a doubles event with `count` genuine UNGROUPED individuals and open Entries. */
async function seedDoublesWithUngrouped(page: any, count = 4): Promise<string> {
  const tournamentId = await seedTournament(page, PROFILE_DOUBLES);

  await page.evaluate((n: number) => {
    // Generate extra INDIVIDUAL participants not consumed by the auto-generated
    // accepted pairs, so we have genuine ungrouped individuals to pair.
    const { tournamentEngine, mocksEngine } = dev.factory;
    const { participants } = mocksEngine.generateParticipants({
      participantsCount: n + 4,
      participantType: 'INDIVIDUAL',
    });
    tournamentEngine.addParticipants({ participants });

    const tournament = dev.getTournament();
    const event = tournament.events?.[0];
    if (!event) return;

    const enteredIds = new Set((event.entries || []).map((e: any) => e.participantId));
    const pairMemberIds = new Set<string>();
    for (const p of tournament.participants) {
      if (p.participantType === 'PAIR') for (const ip of p.individualParticipantIds || []) pairMemberIds.add(ip);
    }
    const individuals = tournament.participants
      .filter(
        (p: any) =>
          p.participantType === 'INDIVIDUAL' && !enteredIds.has(p.participantId) && !pairMemberIds.has(p.participantId),
      )
      .slice(0, n);
    for (const p of individuals) {
      event.entries.push({ participantId: p.participantId, entryStatus: 'UNGROUPED', entryStage: 'MAIN' });
    }
    tournamentEngine.setState(tournament);
  }, count);

  const tournamentPage = new TournamentPage(page);
  await tournamentPage.goto(tournamentId);
  await tournamentPage.navigateToEvents();
  await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
  await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
  const entriesVisible = await page.locator(S.ENTRIES_VIEW).isVisible().catch(() => false);
  if (!entriesVisible) await page.locator('#eventTabsBar').getByText('Entries').click();
  await page.waitForSelector(S.ENTRIES_VIEW, { state: 'visible', timeout: 10_000 });
  await page.locator(`${S.ENTRIES_VIEW} .tag`).first().waitFor({ state: 'visible', timeout: 5_000 });
  return tournamentId;
}

/** Re-enter the Entries tab to force a re-render from the (always-current) engine. */
async function reloadEntries(page: any): Promise<void> {
  await page.locator('#eventTabsBar').getByText('Draws').click();
  await page.waitForTimeout(300);
  await page.locator('#eventTabsBar').getByText('Entries').click();
  await page.waitForSelector(S.ENTRIES_VIEW, { state: 'visible', timeout: 10_000 });
  await page.locator(`${S.ENTRIES_VIEW} .tag`).first().waitFor({ state: 'visible', timeout: 5_000 });
}

/** Grouping chips that read a given segment label. */
function chipsWithText(page: any, text: string) {
  return page.locator(`${S.ENTRIES_VIEW} .tag`).filter({ hasText: text });
}

function entryCount(page: any, status: string): Promise<number> {
  return page.evaluate(
    (s: string) => (dev.getTournament().events?.[0]?.entries || []).filter((e: any) => e.entryStatus === s).length,
    status,
  );
}

test.describe('Journey 33 — create-pair refresh + destroy pairs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('33.1 — auto-pairing two ungrouped throws no fatal errors and pairs them', async ({ page }) => {
    const collector = createMutationCollector(page);
    await seedDoublesWithUngrouped(page, 6);

    const errors: string[] = [];
    page.on('pageerror', (err: any) => errors.push(err.message));

    // Pairing mode ON → selecting two ungrouped auto-pairs.
    const pairingBtn = page.getByText('Pairing: OFF');
    await pairingBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await pairingBtn.click();
    await page.waitForTimeout(200);

    const ungroupedBefore = await entryCount(page, 'UNGROUPED');
    const chips = chipsWithText(page, 'Ungrouped');
    expect(await chips.count()).toBeGreaterThanOrEqual(2);
    await chips.nth(0).click();
    await chips.nth(1).click();
    await collector.waitForMethod('addEventEntryPairs', 10_000);

    // Re-render from the engine, then click rows — the reported crash fired on
    // row clicks after the pair refresh.
    await reloadEntries(page);
    const rows = page.locator(`${S.ENTRIES_VIEW} .tabulator-row`);
    const toClick = Math.min(await rows.count(), 5);
    for (let i = 0; i < toClick; i++) {
      await rows.nth(i).locator('.tag').first().click().catch(() => {});
      await page.waitForTimeout(60);
    }

    // The pairing reduced the ungrouped count by two (two became one ALTERNATE pair).
    expect(await entryCount(page, 'UNGROUPED')).toBe(ungroupedBefore - 2);
    expect(await entryCount(page, 'ALTERNATE')).toBe(1);

    const fatal = errors.filter(
      (e) => e.includes("reading 'add'") || e.includes('TypeError') || e.includes('is not a function'),
    );
    expect(fatal).toEqual([]);
    collector.detach();
  });

  test('33.2 — destroying a pair returns both individuals to Ungrouped (no crash)', async ({ page }) => {
    const collector = createMutationCollector(page);
    await seedDoublesWithUngrouped(page, 6);

    const errors: string[] = [];
    page.on('pageerror', (err: any) => errors.push(err.message));

    // Create one ALTERNATE pair from genuine ungrouped individuals.
    await page.evaluate(() => {
      const event = dev.getTournament().events?.[0];
      if (!event) return;
      const ids = (event.entries || [])
        .filter((e: any) => e.entryStatus === 'UNGROUPED')
        .slice(0, 2)
        .map((e: any) => e.participantId);
      dev.factory.tournamentEngine.addEventEntryPairs({
        participantIdPairs: [ids],
        allowDuplicateParticipantIdPairs: true,
        entryStatus: 'ALTERNATE',
        entryStage: 'MAIN',
        uuids: [dev.factory.tools.UUID()],
        eventId: event.eventId,
      });
    });
    await reloadEntries(page);

    const ungroupedBefore = await entryCount(page, 'UNGROUPED');
    expect(await entryCount(page, 'ALTERNATE')).toBe(1);

    // Select the Alternates pair row and click "Destroy pairs".
    const alternateChip = chipsWithText(page, 'Alternates').first();
    await alternateChip.waitFor({ state: 'visible', timeout: 5_000 });
    await alternateChip.click();

    const destroyBtn = page.getByText('Destroy pairs');
    await destroyBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await destroyBtn.click();

    await collector.waitForMethod('destroyPairEntries', 10_000);
    await page.waitForTimeout(300);

    // Factory: pair removed, both individuals returned to UNGROUPED.
    expect(await entryCount(page, 'ALTERNATE')).toBe(0);
    expect(await entryCount(page, 'UNGROUPED')).toBe(ungroupedBefore + 2);

    // UI (after re-render from engine): no Alternates chip remains.
    await reloadEntries(page);
    expect(await chipsWithText(page, 'Alternates').count()).toBe(0);

    const fatal = errors.filter((e) => e.includes("reading 'add'") || e.includes('TypeError'));
    expect(fatal).toEqual([]);
    collector.detach();
  });

  test('33.3 — a wiped/recycled row is not selectable (no _selectRow crash)', async ({ page }) => {
    await seedDoublesWithUngrouped(page, 6);

    const errors: string[] = [];
    page.on('pageerror', (err: any) => errors.push(err.message));

    // Faithfully reproduce the reported failure mode: a Row whose backing
    // element has been wiped to `false` (as deleteActual/recycling leaves it)
    // while its DOM element + click listener still exist. The row-element click
    // listener calls selectRow.toggleRow(row); without the guard this reaches
    // _selectRow → `false.classList.add` → "reading 'add'".
    const result = await page.evaluate(() => {
      const table = (dev as any).tournamentContext?.tables?.['unifiedEntries'];
      if (!table) return { ok: false as const, reason: 'no table' };
      const selectMod = table.modules.selectRow;
      const rowComp = table.getRows().find((r: any) => !r.getData()._isSeparator);
      if (!rowComp) return { ok: false as const, reason: 'no row' };
      const row = rowComp._row;
      row.element = false; // simulate the wiped/recycled row
      let crash: string | null = null;
      try {
        selectMod.toggleRow(row); // exactly what the row click listener invokes
      } catch (e: any) {
        crash = e.message;
      }
      return { ok: true as const, crash, selectable: selectMod.checkRowSelectability(row) };
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Guard makes the wiped row unselectable, so toggleRow is a no-op.
      expect(result.selectable).toBe(false);
      expect(result.crash).toBeNull();
    }
    const fatal = errors.filter((e) => e.includes("reading 'add'") || e.includes('TypeError'));
    expect(fatal).toEqual([]);
  });
});
