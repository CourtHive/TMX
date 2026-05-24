/**
 * Journey 34 — Unified entries: row-number column + column-selector menu
 *
 * The unified entries table gained a row-number column (formatter 'rownum')
 * with a header column-selector menu (headerMenu), mirroring the participants
 * and matchUps tables. The row numbers let a TD see the entry count at a glance;
 * the header menu toggles individual column visibility (persisted to
 * localStorage via context.columns).
 */
import { test, expect } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, MockProfile } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

const PROFILE_SINGLES: MockProfile = {
  tournamentName: 'E2E Rownum',
  tournamentAttributes: { tournamentId: 'e2e-rownum' },
  participantsProfile: { scaledParticipantsCount: 16 },
  // 8 accepted singles entries (no draw) — small enough that all rows render.
  drawProfiles: [{ eventName: 'Singles', drawSize: 8, generate: false }],
};

async function navigateToEntries(page: any): Promise<void> {
  const tournamentId = await seedTournament(page, PROFILE_SINGLES);
  const tournamentPage = new TournamentPage(page);
  await tournamentPage.goto(tournamentId);
  await tournamentPage.navigateToEvents();
  await tournamentPage.eventsTable.locator('.tabulator-row').first().click();
  await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
  const entriesVisible = await page.locator(S.ENTRIES_VIEW).isVisible().catch(() => false);
  if (!entriesVisible) await page.locator('#eventTabsBar').getByText('Entries').click();
  await page.waitForSelector(S.ENTRIES_VIEW, { state: 'visible', timeout: 10_000 });
  await page.locator(`${S.ENTRIES_VIEW} .tabulator-row`).first().waitFor({ state: 'visible', timeout: 5_000 });
}

test.describe('Journey 34 — row-number column + column-selector menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('34.1 — row-number column numbers rows 1..N (entry count visible)', async ({ page }) => {
    await navigateToEntries(page);

    const entryCount = await page.evaluate(() => dev.getTournament().events?.[0]?.entries?.length ?? 0);
    expect(entryCount).toBe(8);

    // The 2nd cell of each row is the rownum cell (1st is the 5px selection cell).
    const rowNums = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#entriesView .tabulator-row'));
      return rows
        .map((r) => (r.querySelectorAll('.tabulator-cell')[1] as HTMLElement)?.textContent?.trim())
        .filter((t): t is string => !!t)
        .map(Number)
        .filter((n) => !Number.isNaN(n));
    });

    expect(rowNums).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    // The largest row number equals the entry count.
    expect(Math.max(...rowNums)).toBe(entryCount);
  });

  test('34.2 — column-selector menu toggles a column off and persists', async ({ page }) => {
    await navigateToEntries(page);

    const statusVisible = () =>
      page.evaluate(() => {
        const table = (dev as any).tournamentContext?.tables?.['unifiedEntries'];
        return table?.getColumns().find((c: any) => c.getField() === 'status')?.isVisible();
      });
    expect(await statusVisible()).toBe(true);

    // Open the header column-selector menu (the rownum column carries headerMenu).
    // Tabulator keeps the menu button at opacity:0 until the column header is
    // hovered, so hover first to reveal it.
    const menuCol = page
      .locator(`${S.ENTRIES_VIEW} .tabulator-col`)
      .filter({ has: page.locator('.tabulator-header-popup-button') })
      .first();
    await menuCol.hover();
    await page.locator(`${S.ENTRIES_VIEW} .tabulator-header-popup-button`).first().click({ force: true });
    const menu = page.locator('.tabulator-menu');
    await menu.waitFor({ state: 'visible', timeout: 5_000 });

    // Name and Grouping are locked → never offered in the toggle menu.
    expect(await menu.locator('.tabulator-menu-item', { hasText: 'Name' }).count()).toBe(0);
    expect(await menu.locator('.tabulator-menu-item', { hasText: 'Grouping' }).count()).toBe(0);

    // Toggle "Status" off.
    await menu.locator('.tabulator-menu-item', { hasText: 'Status' }).first().click();
    await page.waitForTimeout(300);

    // The Status column is now hidden.
    expect(await statusVisible()).toBe(false);

    // Preference persisted to localStorage (context.columns).
    const persisted = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem('tmx_columns') || '{}').status;
      } catch {
        return undefined;
      }
    });
    expect(persisted).toBe(false);
  });

  test('34.3 — locked Name/Grouping columns ignore saved hidden state', async ({ page }) => {
    // Simulate a saved/cross-table preference that hides the shared `participant`
    // (Name) and `segment` (Grouping) keys plus a normal `status` key. The locked
    // columns must stay visible; the unlocked one must honor the saved state.
    await page.evaluate(() =>
      localStorage.setItem('tmx_columns', JSON.stringify({ participant: false, segment: false, status: false })),
    );
    await page.reload();
    await waitForAppReady(page);
    await initDevBridge(page);
    await navigateToEntries(page);

    const visible = await page.evaluate(() => {
      const table = (dev as any).tournamentContext?.tables?.['unifiedEntries'];
      const vis = (f: string) => table?.getColumns().find((c: any) => c.getField() === f)?.isVisible();
      return { participant: vis('participant'), segment: vis('segment'), status: vis('status') };
    });

    expect(visible.participant).toBe(true); // locked → stays visible
    expect(visible.segment).toBe(true); // locked → stays visible
    expect(visible.status).toBe(false); // not locked → honors saved hidden state
  });

  test('34.4 — selection cell single-toggles (no redundant cellClick)', async ({ page }) => {
    await navigateToEntries(page);

    const selectedCount = () =>
      page.evaluate(() => (dev as any).tournamentContext?.tables?.['unifiedEntries']?.getSelectedData().length ?? -1);

    // Structural guard: the rowSelection column must NOT carry a cellClick — with
    // selectableRows:true the row-level listener already toggles selection, so a
    // cellClick:toggleSelect would double-toggle (net-zero) on cell-area clicks.
    const hasCellClick = await page.evaluate(() => {
      const table = (dev as any).tournamentContext?.tables?.['unifiedEntries'];
      const col = table?.getColumns().find((c: any) => c.getDefinition().formatter === 'rowSelection');
      return typeof col?.getDefinition().cellClick === 'function';
    });
    expect(hasCellClick).toBe(false);

    // Behavioral: clicking the selection cell selects exactly one row, and again deselects.
    expect(await selectedCount()).toBe(0);
    const firstRow = page.locator(`${S.ENTRIES_VIEW} .tabulator-row`).first();
    await firstRow.locator('.tabulator-cell').first().click();
    expect(await selectedCount()).toBe(1);
    await firstRow.locator('.tabulator-cell').first().click();
    expect(await selectedCount()).toBe(0);

    // Clicking the row body (Grouping cell) also selects exactly one row.
    await firstRow.locator('.tabulator-cell').nth(2).click();
    expect(await selectedCount()).toBe(1);
  });
});
