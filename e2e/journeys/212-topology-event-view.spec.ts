import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { getTournamentRecord, seedTournament } from '../helpers/seed';
import { generateFromTopology } from '../helpers/topologyGenerate';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Journey 212 — the draw builder is one of the event's views (CA 2026-11-17).
 *
 * Entries' Add draw is a split button: the drawer stays one click, the builder opens from its menu. The builder shows
 * under the event's own selector and tabs; leaving it keeps the canvas as the event's draft, whose tab stays until the
 * draw is made or the draft discarded. The Add Draw drawer hands its choices to the builder.
 */
const PROFILE = {
  tournamentName: 'Topology Event View E2E',
  tournamentAttributes: { tournamentId: 'e2e-topology-event-view-001' },
  participantsProfile: { participantsCount: 20 },
  eventProfiles: [{ eventName: 'Open Singles', participantsProfile: { participantsCount: 20 } }],
};

const tab = (page: Page, name: string) => page.locator('#eventTabsBar .event-tab-btn', { hasText: name });
const mainCard = (page: Page) => page.locator('#tmxTopology .tb-card').first();

async function openEntries(page: Page): Promise<string> {
  const tournamentId = await seedTournament(page, PROFILE);
  const record: any = await getTournamentRecord(page);
  const eventId = record.events[0].eventId;
  await page.goto(`/#/tournament/${tournamentId}/event/${eventId}`);
  await expect(tab(page, 'Entries')).toBeVisible({ timeout: 10_000 });
  return eventId;
}

async function openBuilderFromMenu(page: Page): Promise<void> {
  await page.locator('#eventControl .dropdown-split-toggle').click();
  await page.locator('#eventControl .dropdown-item', { hasText: 'Draw builder' }).click();
  await expect(mainCard(page)).toBeVisible({ timeout: 10_000 });
}

test.describe('Topology — the draw builder as an event view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
  });

  test('opens from the Add draw menu, under the event, and keeps its canvas while the director looks elsewhere', async ({
    page,
  }) => {
    await openEntries(page);
    // no draft yet: no builder tab
    await expect(tab(page, 'Draw builder')).toHaveCount(0);

    await openBuilderFromMenu(page);
    await expect(tab(page, 'Draw builder')).toHaveCSS('font-weight', '600');
    await expect(page.locator('#eventSelector')).toContainText('Open Singles');
    await expect(mainCard(page).locator('.tb-card-size')).toHaveText('×32');
    await page.screenshot({ path: test.info().outputPath('builder-in-event.png') });

    // the size lever grows the 32 to a 64: the canvas changes
    await mainCard(page).locator('.tb-fit-stepper[data-lever="size"] .tb-fit-step[data-direction="up"]').click();
    await expect(mainCard(page).locator('.tb-card-size')).toHaveText('×64');

    // to the entries and back: the draft's tab stays, and the canvas is as it was left
    await tab(page, 'Entries').click();
    await expect(page.locator('#tmxTopology')).toBeHidden();
    await expect(tab(page, 'Draw builder')).toBeVisible();
    await tab(page, 'Draw builder').click();
    await expect(mainCard(page).locator('.tb-card-size')).toHaveText('×64');

    // discarded, the draft is gone: the tab with it, and the builder opens fresh
    await tab(page, 'Entries').click();
    await page.locator('#eventTabsBar .event-tab-discard').click();
    await page.getByRole('button', { name: 'Ok', exact: true }).click();
    await expect(tab(page, 'Draw builder')).toHaveCount(0);
    await openBuilderFromMenu(page);
    await expect(mainCard(page).locator('.tb-card-size')).toHaveText('×32');
  });

  test("Add draw's own click still opens the drawer, which hands its choices to the builder", async ({ page }) => {
    await openEntries(page);
    await page.locator('#eventControl .dropdown-split-main').click();
    const drawer = page.locator('#tmxDrawer');
    await expect(drawer.locator('#generateDraw')).toBeVisible();
    await expect(page.locator('#eventControl .dropdown.is-active')).toHaveCount(0);

    const field = (label: string) => drawer.locator(`.field:has(.label:text-is("${label}"))`);
    await field('Draw name').locator('input').fill('Gold');
    await field('Draw size').locator('input').fill('64');
    await drawer.getByRole('button', { name: /Open in draw builder/ }).click();

    await expect(mainCard(page).locator('.tb-card-size')).toHaveText('×64', { timeout: 10_000 });
    await expect(tab(page, 'Draw builder')).toHaveCSS('font-weight', '600');
  });

  test('making the draw lets the draft go', async ({ page }) => {
    await openEntries(page);
    await openBuilderFromMenu(page);
    await generateFromTopology(page, page.locator('#tmxTopology'));
    await expect
      .poll(async () => ((await getTournamentRecord(page)) as any).events[0].drawDefinitions?.length ?? 0, {
        timeout: 10_000,
      })
      .toBe(1);
    await expect(tab(page, 'Draws')).toHaveCSS('font-weight', '600');
    await expect(tab(page, 'Draw builder')).toHaveCount(0);
  });
});
