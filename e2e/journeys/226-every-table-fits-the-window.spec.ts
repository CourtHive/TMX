import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';

/**
 * Journey 226 — every page table reaches the window's bottom (CA 2026-11-22).
 *
 * The participants and matchUps tables are sized from their top to the window's bottom (`fitTableToViewportBottom`,
 * journey 225). The rest were a fraction of the window: a band of background under them on a tall window, their
 * bottom rows below the fold on a short one. Each table here must end 8px above the window's bottom, at two window
 * heights. The venues table is a minimum (its rows expand into court tables), so it reaches the bottom at least.
 */

const GAP = 8;

type Seed = { tournamentId: string; eventId: string; drawId: string; rrEventId: string; rrDrawId: string };

async function seed(page: Page): Promise<Seed> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);
  return page.evaluate(async () => {
    const { tournamentRecord, eventIds, drawIds } = dev.factory.mocksEngine.generateTournamentRecord({
      setState: true,
      tournamentName: 'Every table',
      participantsProfile: { participantsCount: 40 },
      drawProfiles: [
        { drawSize: 16, eventName: 'Singles' },
        { drawSize: 4, drawType: 'ROUND_ROBIN', eventName: 'Round robin' },
      ],
      venueProfiles: [{ venueName: 'Main', courtsCount: 4 }],
    });
    await dev.tmx2db.addTournament(dev.factory.tournamentEngine.getTournament().tournamentRecord ?? tournamentRecord);
    return {
      tournamentId: tournamentRecord.tournamentId,
      eventId: eventIds[0],
      drawId: drawIds[0],
      rrEventId: eventIds[1],
      rrDrawId: drawIds[1],
    };
  });
}

/** the visible table's bottom once its fit has settled */
async function tableBottom(page: Page, selector: string): Promise<number> {
  const table = page.locator(`${selector}.tabulator, ${selector} .tabulator`).filter({ visible: true }).first();
  await expect(table).toBeVisible();
  let bottom = 0;
  await expect
    .poll(async () => {
      const box = (await table.boundingBox())!;
      const next = Math.round(box.y + box.height);
      const settled = next === bottom;
      bottom = next;
      return settled;
    })
    .toBe(true);
  return bottom;
}

for (const height of [720, 1000]) {
  test(`every page table ends at the window's bottom in a ${height}px window`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height });
    const { tournamentId, eventId, drawId, rrEventId, rrDrawId } = await seed(page);
    const route = (path: string) => page.evaluate((p) => dev.tournamentContext.router?.navigate(p), path);
    const expected = height - GAP;

    const pages: [string, string, string][] = [
      ['events', `/tournament/${tournamentId}/events`, '#tournamentEvents'],
      ['rounds', `/tournament/${tournamentId}/event/${eventId}/draw/${drawId}/view/roundsTable`, '#drawsView'],
      ['stats', `/tournament/${tournamentId}/event/${eventId}/draw/${drawId}/view/roundsStats`, '#drawsView'],
      ['ratings', `/tournament/${tournamentId}/event/${eventId}/draw/${drawId}/view/dynamicRatings`, '#drawsView'],
      ['bracket', `/tournament/${tournamentId}/event/${rrEventId}/draw/${rrDrawId}/view/roundsBracket`, '#drawsView'],
      ['points', `/tournament/${tournamentId}/event/${eventId}/points`, '#pointsView'],
    ];
    // the events tab opens on its cards unless the table was chosen (eventsViewMode.ts)
    await page.evaluate(() => localStorage.setItem('tmx_events_view_mode', 'table'));
    for (const [name, path, selector] of pages) {
      await route(path);
      // within a pixel: the table starts at a fractional y and the fitted height is whole
      expect.soft(Math.abs((await tableBottom(page, selector)) - expected), name).toBeLessThanOrEqual(1);
    }

    await route(`/tournament/${tournamentId}/venues`);
    expect.soft(await tableBottom(page, '#venuesTable'), 'venues').toBeGreaterThanOrEqual(expected - 1);

    // the tournaments list: signed out, it lists what the demo generator adds (journey 159's route to it)
    await page.goto('/');
    await page.getByText('Generate Demo Tournaments').first().click();
    await page.getByText('Live Schedule', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Generate', exact: true }).click();
    expect
      .soft(Math.abs((await tableBottom(page, '#tournamentsTable')) - expected), 'tournaments')
      .toBeLessThanOrEqual(1);
  });
}
