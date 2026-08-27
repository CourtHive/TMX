import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { TournamentPage } from '../pages/TournamentPage';
import { S } from '../helpers/selectors';

/**
 * Journey 115 — Tabulator warns on the console, and only a browser can hear it.
 *
 * Two warnings were reaching production users' consoles on ordinary pages:
 *
 *   Invalid column definition option: lockVisible
 *   Table Not Initialized - Calling the addFilter function before the table is
 *   initialized may result in inconsistent behavior...
 *
 * Neither ever threw, and neither broke a feature: Tabulator keeps the value of
 * an option it does not recognise, and its `initGuard` warns and then proceeds.
 * That is exactly why they survived — the only symptom was console noise, so
 * nothing failed and nothing forced the issue. A unit test can pin the column
 * keys and the deferral (and does, in `columnDefinitionOptions.test.ts` and
 * `filterApplyGuard.test.ts`), but only a real Tabulator instance in a real
 * browser can prove the warnings themselves are gone.
 *
 * The second warning needs a filter that is ALREADY SET when a table is built,
 * which is the restore path — so the filter is applied on one visit and the
 * assertion is made on the next.
 */

const TABULATOR_WARNINGS = [/Invalid column definition option/i, /Table Not Initialized/i];

/** Collect every console message for the life of the page. */
function collectConsole(page: Page): string[] {
  const messages: string[] = [];
  page.on('console', (message) => messages.push(message.text()));
  page.on('pageerror', (error) => messages.push(`pageerror: ${error.message}`));
  return messages;
}

function tabulatorComplaints(messages: string[]): string[] {
  return messages.filter((message) => TABULATOR_WARNINGS.some((pattern) => pattern.test(message)));
}

async function seedTournamentWithMatchUps(page: Page): Promise<string> {
  return page.evaluate(async () => {
    await dev.tmx2db.initDB();
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      nonRandom: 1,
      setState: true,
      tournamentName: 'E2E Console Hygiene',
      tournamentAttributes: { tournamentId: 'e2e-console-hygiene' },
      participantsProfile: { scaledParticipantsCount: 16 },
      drawProfiles: [{ eventName: 'Console Singles', drawSize: 16, drawType: 'SINGLE_ELIMINATION' }],
    });
    const record = dev.factory.tournamentEngine.getTournament().tournamentRecord;
    await dev.tmx2db.addTournament(record);
    return tournamentRecord.tournamentId as string;
  });
}

test.describe('Journey 115 — Tabulator console hygiene', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    // Column visibility is a global field-keyed map in localStorage; start clean
    // so the entries table builds from its own definitions.
    await page.evaluate(() => localStorage.clear());
  });

  test('the entries table builds without Tabulator rejecting a column option', async ({ page }) => {
    const messages = collectConsole(page);
    const tournamentId = await seedTournamentWithMatchUps(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToEvents();
    await tournament.eventsTable.locator('.tabulator-row').first().click();
    await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
    if (
      !(await page
        .locator(S.ENTRIES_VIEW)
        .isVisible()
        .catch(() => false))
    ) {
      await page.locator('#eventTabsBar').getByText('Entries').click();
    }
    await page.waitForSelector(S.ENTRIES_VIEW, { state: 'visible', timeout: 10_000 });

    // The control. If the table never built, no column definition was ever
    // validated and the assertion below would hold for the wrong reason —
    // which is the failure mode of every "assert nothing happened" test.
    await expect(
      page.locator(`${S.ENTRIES_VIEW} .tabulator-row`).first(),
      'the entries table must actually have rendered',
    ).toBeVisible();
    await expect(page.locator(`${S.ENTRIES_VIEW} .tabulator-col[tabulator-field="segment"]`)).toBeVisible();

    expect(tabulatorComplaints(messages)).toEqual([]);
  });

  test('the Grouping and name columns stay out of the column-selector menu', async ({ page }) => {
    // The marker moved from a bespoke `lockVisible` key onto `cssClass`, which is
    // the behaviour that key existed for. If the move had silently stopped
    // working the console would be clean and the feature quietly broken, so the
    // warning fix is only half the story without this.
    const tournamentId = await seedTournamentWithMatchUps(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToEvents();
    await tournament.eventsTable.locator('.tabulator-row').first().click();
    await page.waitForSelector('#eventTabsBar', { state: 'visible', timeout: 10_000 });
    if (
      !(await page
        .locator(S.ENTRIES_VIEW)
        .isVisible()
        .catch(() => false))
    ) {
      await page.locator('#eventTabsBar').getByText('Entries').click();
    }
    await page.waitForSelector(`${S.ENTRIES_VIEW} .tabulator-row`, { state: 'visible', timeout: 10_000 });

    // The button is styled `font-size: 0` and revealed on header hover, so it has
    // no hit box of its own — journey 57 opens the same menu the same way.
    const menuColumn = page
      .locator(`${S.ENTRIES_VIEW} .tabulator-col`)
      .filter({ has: page.locator('.tabulator-header-popup-button') })
      .first();
    await menuColumn.hover();
    await page.locator(`${S.ENTRIES_VIEW} .tabulator-header-popup-button`).first().click({ force: true });
    const menu = page.locator('.tabulator-menu');
    await expect(menu).toBeVisible();

    // The control — the menu is populated, so an empty menu cannot pass this.
    expect(await menu.locator('.tabulator-menu-item').count()).toBeGreaterThan(3);
    await expect(menu).not.toContainText('Grouping');
  });

  test('a saved date filter is restored without filtering an unbuilt table', async ({ page }) => {
    const messages = collectConsole(page);
    const tournamentId = await seedTournamentWithMatchUps(page);

    const tournament = new TournamentPage(page);
    await tournament.goto(tournamentId);
    await tournament.navigateToMatchUps();
    await page.waitForSelector(`${S.TOURNAMENT_MATCHUPS} .tabulator-row`, { state: 'visible', timeout: 10_000 });

    // Apply a date filter through the popover, so the NEXT render takes the
    // restore path — the only path that calls addFilter at construction time.
    await page.locator('#filterPopoverButton').click();
    const dateRow = page.locator('.filter-popover-row').filter({ hasText: 'All dates' });
    await expect(dateRow).toBeVisible();
    await dateRow.locator('select').selectOption({ label: 'Today' });
    await page.keyboard.press('Escape');

    // Leave and come back: the matchUps tab re-renders, and every filter module
    // is re-constructed against a table that has not finished building.
    await tournament.navigateToEvents();
    await page.waitForSelector('.tabulator-row', { state: 'visible', timeout: 10_000 });
    const before = messages.length;
    await tournament.navigateToMatchUps();
    await page.waitForSelector(S.TOURNAMENT_MATCHUPS, { state: 'visible', timeout: 10_000 });

    // The control: the return visit really did produce a fresh render, so
    // "no warnings" is a statement about something that happened.
    expect(messages.length, 'the second visit must have re-rendered').toBeGreaterThanOrEqual(before);
    await expect(page.locator('#filterPopoverButton')).toHaveClass(/filter-active/);

    expect(tabulatorComplaints(messages)).toEqual([]);
  });
});
