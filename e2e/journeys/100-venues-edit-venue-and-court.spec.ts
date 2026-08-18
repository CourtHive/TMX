import { test, expect, Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { seedTournament, PROFILE_WITH_VENUES } from '../helpers/seed';
import { TournamentPage } from '../pages/TournamentPage';

/**
 * Journey 100 — editing a venue and a court from the venues table.
 *
 * Why this exists: until now nothing covered the edit drawers at all. #1306 and #1307 both landed
 * on this surface — the first because the table never re-read the engine after an add, the second
 * because both edit drawers handed their callback two different shapes — and in each case the
 * absence of edit coverage is what let the defect sit unnoticed.
 *
 * The interesting behaviour here is not that a name changes. It is that `venueActions.doneEditing`
 * patches the Tabulator row from the callback payload while the *nested* courts table is refreshed
 * separately from the engine. Those are two different data paths kept in step by hand, so the
 * assertions below pin both: the venue row's own cells, and the nested table's derived
 * Scheduled/Unscheduled columns, which exist only because `mapVenue` computes them through the
 * AvailabilityEngine and which a naive row patch would blank.
 */

const VENUE_ROW = '#venuesTable .tabulator-row';
const SUB_ROWS = '#venuesTable .subTable .tabulator-row';
const HEADER = '.section:has(#venuesTable) .tabHeader';

/** Fields carry no ids, so target them by their label. */
const field = (page: Page, label: string) =>
  page.locator(`.drawer .field:has(label.label:text-is("${label}")) input`).first();

async function gotoVenuesTable(page: Page) {
  const tournamentId = await seedTournament(page, PROFILE_WITH_VENUES);
  await page.evaluate(() => localStorage.setItem('tmx_venues_view_mode', 'table'));
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToVenues();
  await expect(page.locator(VENUE_ROW).first()).toBeVisible({ timeout: 10_000 });
}

/**
 * Open a row's ⋮ menu and pick an item.
 *
 * `venueActions`/`courtActions` both begin by clearing any stray `.tippy-content` and returning
 * without opening, so a leftover popover silently swallows the first click. Click again rather than
 * letting that read as a broken menu.
 */
async function openRowMenu(page: Page, row: ReturnType<Page['locator']>, item: string) {
  const dots = row.locator('.fa-ellipsis-vertical').first();
  const entry = page.getByText(item, { exact: true });
  await dots.click();
  if (!(await entry.isVisible().catch(() => false))) await dots.click();
  await expect(entry).toBeVisible({ timeout: 10_000 });
  await entry.click();
}

/** Expand the venue row to reveal its nested courts table. */
async function toggleCourts(page: Page) {
  await page.locator(VENUE_ROW).first().locator('.tabulator-cell').nth(2).click();
}

test.describe('Journey 100 — edit a venue and a court', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('editing venue name and abbreviation updates the row and the record', async ({ page }) => {
    await gotoVenuesTable(page);
    await expect(page.locator(HEADER)).toContainText('Venues (1)');

    await openRowMenu(page, page.locator(VENUE_ROW).first(), 'Edit');
    await expect(field(page, 'Venue name')).toBeVisible({ timeout: 10_000 });
    await field(page, 'Venue name').fill('Riverside Tennis Center');
    await field(page, 'Abbreviation').fill('RTC');
    await page.locator('.drawer button', { hasText: 'Save' }).click();

    await expect(page.locator(VENUE_ROW).first()).toContainText('Riverside Tennis Center', { timeout: 8_000 });
    await expect(page.locator(VENUE_ROW).first()).toContainText('RTC');

    // The row is patched in place rather than re-read, so confirm the record actually changed too —
    // a row that updates without the mutation landing would look identical on screen.
    await expect
      .poll(() => page.evaluate(() => dev.getTournament().venues?.[0]?.venueName), { timeout: 8_000 })
      .toBe('Riverside Tennis Center');

    // Adding a venue is not the only thing that must keep the header honest.
    await expect(page.locator(HEADER)).toContainText('Venues (1)');
  });

  test('renaming courts keeps the nested table derived columns intact', async ({ page }) => {
    await gotoVenuesTable(page);

    await toggleCourts(page);
    await expect(page.locator(SUB_ROWS).first()).toBeVisible({ timeout: 10_000 });
    // Scheduled/Unscheduled are computed by mapVenue through the AvailabilityEngine; they are the
    // part a row patch built from raw form values would silently drop.
    await expect(page.locator(SUB_ROWS).first()).toContainText('Court 1');
    await expect(page.locator(SUB_ROWS).first()).toContainText('96h');
    await toggleCourts(page);

    await openRowMenu(page, page.locator(VENUE_ROW).first(), 'Edit');
    await expect(field(page, 'Venue name')).toBeVisible({ timeout: 10_000 });
    await field(page, 'Abbreviation').fill('CCC'); // seeded venue has none; Save stays disabled without it
    await field(page, 'Court name base').fill('Stadium');
    // The input is visually hidden by `is-checkradio`; the label is the click target.
    await page.locator('label[for="updateCourtNames"]').click();
    await page.locator('.drawer button', { hasText: 'Save' }).click();

    await toggleCourts(page);
    await expect(page.locator(SUB_ROWS).first()).toContainText('Stadium 1', { timeout: 8_000 });
    await expect(page.locator(SUB_ROWS).first()).toContainText('96h');
    await expect(page.locator(SUB_ROWS).nth(1)).toContainText('Stadium 2');
  });

  test('changing the court name base alone does not rename courts', async ({ page }) => {
    await gotoVenuesTable(page);

    await openRowMenu(page, page.locator(VENUE_ROW).first(), 'Edit');
    await expect(field(page, 'Venue name')).toBeVisible({ timeout: 10_000 });
    await field(page, 'Abbreviation').fill('CCC');
    await field(page, 'Court name base').fill('Stadium');
    // Deliberately NOT ticking updateCourtNames.
    await page.locator('.drawer button', { hasText: 'Save' }).click();

    // Renaming every court is destructive and opt-in. Typing a base while exploring the form must
    // not trigger it — this is the assertion that makes the checkbox meaningful rather than
    // decorative, and it fails if the gate is ever dropped.
    await expect
      .poll(() => page.evaluate(() => dev.getTournament().venues?.[0]?.venueAbbreviation), { timeout: 8_000 })
      .toBe('CCC');
    const names = await page.evaluate(() =>
      (dev.getTournament().venues?.[0]?.courts ?? []).map((c: any) => c.courtName),
    );
    expect(names.every((n: string) => n.startsWith('Court '))).toBe(true);
  });

  test('editing a single court updates its row in the nested table', async ({ page }) => {
    await gotoVenuesTable(page);

    await toggleCourts(page);
    const courtRow = page.locator(SUB_ROWS).first();
    await expect(courtRow).toBeVisible({ timeout: 10_000 });

    await openRowMenu(page, courtRow, 'Edit');
    await expect(field(page, 'Court name')).toBeVisible({ timeout: 10_000 });
    await field(page, 'Court name').fill('Show Court');
    await page.locator('.drawer button', { hasText: 'Save' }).click();

    // courtActions re-reads the court from the engine rather than trusting the callback payload,
    // which is the shape the venue drawer's own consumer should be measured against.
    await expect(page.locator(SUB_ROWS).first()).toContainText('Show Court', { timeout: 8_000 });
    await expect(page.locator(SUB_ROWS).first()).toContainText('96h');
  });
});
