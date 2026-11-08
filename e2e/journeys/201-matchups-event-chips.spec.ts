import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';
import { seedTournament } from '../helpers/seed';

/**
 * Journey 201 — events and flights become chips when there are two (CA 2026-11-08: "unless there were < 3
 * options"), and stay a dropdown otherwise. Names read as written: "Men's Singles" showed as "Men&#39;s Singles"
 * because the labels were HTML-escaped and then written as text.
 */
const rowCount = async (page: Page) => {
  const text =
    (await page
      .getByText(/^Matches \(\d+\)$/)
      .first()
      .textContent()) ?? '';
  return Number(/\((\d+)\)/.exec(text)?.[1]);
};

async function openMatchUpsFilters(page: Page, drawProfiles: any[], tournamentId: string) {
  const id = await seedTournament(page, { tournamentAttributes: { tournamentId }, drawProfiles } as any);
  const tournament = new TournamentPage(page);
  await tournament.goto(id);
  await tournament.navigateToMatchUps();
  await expect.poll(() => rowCount(page)).toBeGreaterThan(0);
  await page.locator('#filterPopoverButton').click();
}

test.describe('Journey 201 — event and flight chips', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('two events: Event chips, named as written; a click selects one', async ({ page }) => {
    await openMatchUpsFilters(
      page,
      [
        { eventName: "Men's Singles", drawSize: 8 },
        { eventName: "Women's Singles", drawSize: 4 },
      ],
      'e2e-matchups-event-chips',
    );
    const eventChips = page.locator('.filter-popover-chips[aria-label="Event"] .filter-popover-chip');
    await expect(eventChips).toHaveText(["Men's Singles", "Women's Singles"]);
    await expect(page.locator('.filter-popover-chips[aria-label="Flight"] .filter-popover-chip')).toHaveCount(2);

    const eventGroup = page.locator('.filter-popover-chips[aria-label="Event"]');
    // exact names: "Men's Singles" is a substring of "Women's Singles" to a case-insensitive match
    await eventGroup.getByRole('button', { name: "Women's Singles", exact: true }).click();
    await expect.poll(() => rowCount(page)).toBe(3);
    await expect(eventGroup.getByRole('button', { name: "Men's Singles", exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  test('three events: the dropdown, named as written', async ({ page }) => {
    await openMatchUpsFilters(
      page,
      [
        { eventName: "Men's Singles", drawSize: 4 },
        { eventName: "Women's Singles", drawSize: 4 },
        { eventName: "Boys' Singles", drawSize: 4 },
      ],
      'e2e-matchups-event-dropdown',
    );
    await expect(page.locator('.filter-popover-chips[aria-label="Event"]')).toHaveCount(0);
    const select = page.locator('.filter-popover-row', { hasText: 'All events' }).locator('select');
    await expect(select.locator('option')).toHaveText([
      'All events',
      "Men's Singles",
      "Women's Singles",
      "Boys' Singles",
    ]);
    await select.selectOption({ label: "Boys' Singles" });
    await expect.poll(() => rowCount(page)).toBe(3);
  });
});
